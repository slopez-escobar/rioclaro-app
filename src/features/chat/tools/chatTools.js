import { can } from "../../auth/permissions.js";
import { normalizeName, extractSize } from "../../catalog/domain/catalogMatching.js";
import {
  getCliente,
  getMiCliente,
} from "../../../data/repositories/clientesRepository.js";
import {
  getExistencia,
  getExistenciasMeta,
  listExistencias,
} from "../../../data/repositories/existenciasRepository.js";
import {
  getPedido,
  listPedidos,
} from "../../../data/repositories/pedidosRepository.js";
import {
  getProducto,
  getAliasIndex,
  listProductos,
} from "../../../data/repositories/catalogoRepository.js";
import { listSucursales, getSucursal } from "../../../data/repositories/sucursalesRepository.js";
import {
  fragmentsAllowed,
  policiesAllowed,
  searchPolicies,
} from "../domain/index.js";
import { loadKnowledgeBase } from "../knowledge/index.js";
import { registerComplaint } from "../../complaints/services/complaintService.js";
import { getComplaintRepository } from "../../complaints/complaintRepository.js";
import { getCatalogoPedidos } from "../../../data/repositories/catalogoPedidosRepository.js";
import {
  getOrderStateLabel,
  isOrderInProgress,
} from "../../orders/domain/orderLabels.js";

const DEFAULT_REPOS = {
  clientes: { getCliente, getMiCliente },
  existencias: { getExistencia, getExistenciasMeta, listExistencias },
  pedidos: { getPedido, listPedidos },
  catalogo: { getProducto, getAliasIndex, listProductos },
  sucursales: { listSucursales, getSucursal },
};
let clientStockPromise;

function stripAccents(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX");
}

function searchableName(value) {
  return normalizeName(value)
    .replace(/\b(de|del|para|con)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function loadClientStock() {
  if (!clientStockPromise) {
    clientStockPromise = import("@data/source/existencias.json")
      .then(({ default: data }) => ({
        records: data.existencias,
        fechaCorte: data.meta.fechaCorte,
      }));
  }
  return clientStockPromise;
}

async function currentKnowledge(input) {
  return input || loadKnowledgeBase();
}

async function resolveProduct(productText, catalog) {
  const raw = String(productText ?? "").trim();
  const key = raw.toLocaleUpperCase("es-MX");
  const exact = await catalog.getProducto(key);
  if (exact) return { producto: exact };
  if (!raw) return { tipo: "sin_producto" };

  const aliases = await catalog.getAliasIndex();
  const products = await catalog.listProductos();
  const query = searchableName(raw);
  const querySize = extractSize(raw);
  const normalizedAlias = aliases.get(stripAccents(raw).replace(/[^\p{L}\p{N}]+/gu, " ").trim());
  if (normalizedAlias) {
    const product = await catalog.getProducto(normalizedAlias);
    if (product) return { producto: product };
  }
  const queryWords = query.split(" ").filter(Boolean);
  let matched = [];
  for (let size = Math.min(5, queryWords.length); size >= 1; size -= 1) {
    const candidates = new Set();
    for (let start = 0; start <= queryWords.length - size; start += 1) {
      const ngram = queryWords.slice(start, start + size).join(" ");
      for (const product of products) {
        const names = [product.nombre, product.presentacion, ...(product.alias || [])]
          .map(searchableName)
          .filter(Boolean);
        if (names.some((name) => name.includes(ngram))) candidates.add(product);
      }
    }
    if (candidates.size) {
      matched = [...candidates].filter((product) => {
        if (!querySize) return true;
        return [product.nombre, product.presentacion, ...(product.alias || [])]
          .some((name) => {
            const size = extractSize(name);
            return size && size.cantidad === querySize.cantidad && size.unidad === querySize.unidad;
          });
      });
      if (matched.length) break;
    }
  }
  if (!matched.length) return { tipo: "sin_producto" };
  if (matched.length > 1) {
    return {
      tipo: "ambiguo",
      opciones: matched.map(({ claveProducto, nombre }) => ({ clave: claveProducto, nombre })),
    };
  }
  return { producto: matched[0] };
}

function branchForInput(sucursales, text) {
  const normalized = stripAccents(text);
  if (!normalized) return null;
  return sucursales.find((branch) => {
    const city = stripAccents(branch.ciudad);
    const id = stripAccents(branch.id);
    const completeName = stripAccents(branch.nombre);
    return normalized === id
      || normalized.includes(city)
      || normalized.includes(completeName)
      || city.includes(normalized);
  }) || null;
}

function unavailableFonte(product, corte) {
  return {
    tipo: "existencias",
    id: product.claveProducto,
    titulo: product.nombre,
    detalle: `corte ${corte}`,
  };
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function policySource(policy) {
  return {
    tipo: "politica",
    id: policy.id,
    titulo: policy.titulo,
    version: policy.version,
  };
}

/**
 * Construye herramientas del chat con dependencias reemplazables para pruebas.
 * @param {Object} deps Repositorios, conocimiento, servicio de quejas y reloj.
 * @returns {Object} Herramientas autorizadas por la sesión.
 */
export function createTools({
  repos = {},
  knowledge = null,
  complaints = null,
  now = () => new Date(),
} = {}) {
  const repositories = { ...DEFAULT_REPOS, ...repos };
  const getNow = typeof now === "function" ? now : () => now;

  async function consultarExistencias({ producto, sucursal } = {}, session) {
    const isCustomer = session?.rol === "cliente";
    if (!isCustomer && !can(session?.rol, "existencias", "ver")) {
      return { ok: false, tipo: "sin_permiso", fuentes: [] };
    }
    const branches = await repositories.sucursales.listSucursales();
    const requestedBranch = branchForInput(branches, sucursal);
    if (sucursal && !requestedBranch) return { ok: false, tipo: "sin_sucursal", fuentes: [] };
    const ownBranchId = session?.idSucursal;
    if (isCustomer && requestedBranch && requestedBranch.id !== ownBranchId) {
      const ownBranch = branches.find((branch) => branch.id === ownBranchId);
      return { ok: false, tipo: "fuera_de_alcance", sucursalPropia: ownBranch?.ciudad || ownBranch?.nombre, fuentes: [] };
    }
    if (session?.alcance !== "todas" && requestedBranch && requestedBranch.id !== ownBranchId) {
      const ownBranch = branches.find((branch) => branch.id === ownBranchId);
      return { ok: false, tipo: "fuera_de_alcance", sucursalPropia: ownBranch?.ciudad || ownBranch?.nombre, fuentes: [] };
    }
    const resolved = await resolveProduct(producto, repositories.catalogo);
    if (resolved.tipo) return { ok: false, ...resolved, fuentes: [] };
    const product = resolved.producto;

    const targetBranches = requestedBranch
      ? [requestedBranch]
      : session?.alcance === "todas" && !isCustomer
        ? branches
        : branches.filter((branch) => branch.id === ownBranchId);
    const corte = (await repositories.existencias.getExistenciasMeta()).fechaCorte;
    const values = [];
    const privateStock = isCustomer && !repositories.clientStock
      ? await loadClientStock()
      : null;
    for (const branch of targetBranches) {
      if (isCustomer) {
        const stockRecords = repositories.clientStock || privateStock.records;
        const stock = stockRecords.find((item) =>
          item.claveProducto === product.claveProducto && item.idSucursal === branch.id,
        );
        if (!stock) continue;
        values.push({
          sucursal: branch.ciudad,
          disponibilidad: stock.disponible === 0
            ? "Agotado"
            : stock.estatusStock === "bajo"
              ? "Pocas piezas"
              : "Disponible",
        });
      } else {
        const stock = await repositories.existencias.getExistencia(
          session,
          product.claveProducto,
          branch.id,
        );
        if (stock) values.push({ sucursal: branch.ciudad, ...stock });
      }
    }
    return {
      ok: true,
      tipo: "existencias",
      claveProducto: product.claveProducto,
      producto: product.nombre,
      resultados: values,
      ...(values.length === 1 ? values[0] : {}),
      corte,
      fuentes: [unavailableFonte(product, corte)],
    };
  }

  async function consultarPrecio({ producto, idCliente } = {}, session) {
    const resolved = await resolveProduct(producto, repositories.catalogo);
    if (resolved.tipo) return { ok: false, ...resolved, fuentes: [] };
    const product = resolved.producto;
    const catalogSettings = await getCatalogoPedidos();
    const rate = Number(product.tasaIVA ?? catalogSettings.reglasNegocio?.tasaIVA ?? 0.16);
    let client = null;
    if (session?.rol === "cliente") {
      client = await repositories.clientes.getMiCliente(session);
    } else if (idCliente && can(session?.rol, "clientes", "ver")) {
      client = await repositories.clientes.getCliente(session, idCliente);
    }
    const listPrice = roundMoney(Number(product.precioListaMXN));
    const listTax = roundMoney(listPrice * rate);
    const result = {
      ok: true,
      producto: product.nombre,
      claveProducto: product.claveProducto,
      precioLista: listPrice,
      ivaLista: listTax,
      precioConIVA: roundMoney(listPrice + listTax),
      aclaracion: "Los precios son iguales en las 5 sucursales (POL-04).",
    };
    const sources = [{
      tipo: "catalogo",
      id: product.claveProducto,
      titulo: product.nombre,
    }];
    const kb = await currentKnowledge(knowledge);
    const policy = kb.politicas.find((item) => item.id === "POL-04");
    if (policy) sources.push(policySource(policy));
    if (client) {
      const discountPct = ({ grande: 8, mediano: 4, pequeño: 0 })[client.tamano] ?? 0;
      const discountedPrice = roundMoney(listPrice * (1 - discountPct / 100));
      const discountedTax = roundMoney(discountedPrice * rate);
      Object.assign(result, {
        tamanoCliente: client.tamano,
        descuentoPct: discountPct,
        precioConDescuento: discountedPrice,
        ivaConDescuento: discountedTax,
        totalConDescuento: roundMoney(discountedPrice + discountedTax),
      });
    }
    return { ...result, fuentes: sources };
  }

  async function pedidoView(order) {
    const [orderCatalog, branches] = await Promise.all([
      getCatalogoPedidos(),
      repositories.sucursales.listSucursales(),
    ]);
    const supplyingBranch = branches.find((item) => item.id === order.idSucursalSurtido);
    const lastEvent = order.historialEstados?.at(-1) || null;
    return {
      idPedido: order.idPedido,
      folio: order.folio,
      estado: order.estado,
      descripcionEstado: getOrderStateLabel(order.estado, orderCatalog.estadosPedido),
      tipoEntrega: order.tipoEntrega,
      fechaEntregaEstimada: order.fechaEntregaEstimada || null,
      fechaEntrega: order.fechaEntrega || null,
      subtotal: order.resumen?.subtotal ?? null,
      IVA: order.resumen?.iva?.importe ?? null,
      total: order.resumen?.total ?? null,
      sucursalSurtido: supplyingBranch?.ciudad || order.idSucursalSurtido || null,
      surtidoEnOtraSucursal: Boolean(
        order.idSucursalSurtido && order.idSucursalSurtido !== order.idSucursal,
      ),
      ultimoEvento: lastEvent,
      fuentes: [{ tipo: "pedido", id: order.folio }],
    };
  }

  async function estadoPedido({ referencia } = {}, session) {
    try {
      const requestType = String(referencia).toLocaleLowerCase("es-MX");
      if (requestType === "en_curso" || requestType === "mi_pedido") {
        const orders = (await repositories.pedidos.listPedidos(session))
          .filter((order) => requestType === "mi_pedido" || isOrderInProgress(order.estado))
          .sort((a, b) => String(b.fechaPedido).localeCompare(String(a.fechaPedido)));
        if (!orders.length) return { ok: false, tipo: "no_encontrado", fuentes: [] };
        const pedidos = await Promise.all(
          (requestType === "mi_pedido" ? orders.slice(0, 3) : orders)
            .map(pedidoView),
        );
        return { ok: true, pedidos, fuentes: pedidos.flatMap((order) => order.fuentes) };
      }
      const order = await repositories.pedidos.getPedido(session, referencia);
      if (!order) return { ok: false, tipo: "no_encontrado", fuentes: [] };
      return { ok: true, ...(await pedidoView(order)) };
    } catch (error) {
      if (error?.message === "No tienes permiso para ver pedidos") {
        return { ok: false, tipo: "sin_permiso", fuentes: [] };
      }
      throw error;
    }
  }

  async function buscarPolitica({ consulta } = {}, session) {
    const kb = await currentKnowledge(knowledge);
    const policies = policiesAllowed(session, kb.politicas);
    const fragments = fragmentsAllowed(session, kb.fragmentos, kb.politicas);
    const allowed = new Set(policies.map((policy) => policy.id));
    const results = searchPolicies(consulta, fragments)
      .filter(({ fragmento }) => allowed.has(fragmento.polId));
    return {
      ok: results.length > 0,
      resultados: results.map(({ fragmento, puntaje }) => ({
        fragmento,
        puntaje,
        fuente: policySource(policies.find((policy) => policy.id === fragmento.polId)),
      })),
      fuentes: results.map(({ fragmento }) =>
        policySource(policies.find((policy) => policy.id === fragmento.polId)),
      ),
    };
  }

  async function registrarQueja(input = {}, session) {
    const register = typeof complaints === "function"
      ? complaints
      : complaints?.registerComplaint || registerComplaint;
    const complaintRepo = complaints?.repository
      || (complaints?.nextNumber && complaints?.add ? complaints : null)
      || await getComplaintRepository();
    const complaintDeps = complaints?.registerComplaint
      ? complaints.deps
      : {
        clientes: repositories.clientes,
        pedidos: repositories.pedidos,
        complaints: complaintRepo,
        now: getNow,
      };
    const result = await register({ ...input, session }, complaintDeps);
    const kb = await currentKnowledge(knowledge);
    const policy = kb.politicas.find((item) => item.id === "POL-07");
    return {
      ok: true,
      folio: result.folio,
      prioridad: result.prioridad,
      fuentes: policy ? [policySource(policy)] : [],
    };
  }

  return {
    consultarExistencias,
    consultarPrecio,
    estadoPedido,
    buscarPolitica,
    registrarQueja,
  };
}
