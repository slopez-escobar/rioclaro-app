import { can } from "../auth/permissions.js";
import {
  listClientes,
} from "../../data/repositories/clientesRepository.js";
import {
  listPedidos,
} from "../../data/repositories/pedidosRepository.js";
import {
  getConciliacion,
} from "../../data/repositories/ventasConciliacionRepository.js";
import { listProductos } from "../../data/repositories/catalogoRepository.js";
import { listSucursales } from "../../data/repositories/sucursalesRepository.js";
import {
  buildSalesReport,
  classifyOrder,
  inPeriod,
  reconcileReport,
  saleAmounts,
} from "./domain/index.js";
import { toCents } from "./domain/salesRules.js";

function requirePermission(session) {
  if (!can(session?.rol, "reporte_ventas", "ver")) {
    throw new Error("No tienes permiso para ver el reporte de ventas");
  }
}

function availablePeriods(pedidos) {
  return [...new Set(pedidos
    .map((pedido) => String(pedido.fechaPedido || "").slice(0, 7))
    .filter((periodo) => /^\d{4}-\d{2}$/.test(periodo)))]
    .sort((left, right) => right.localeCompare(left));
}

function getSurtidasParaOtras(pedidos, idSucursal, periodo) {
  const porSucursal = {};
  let count = 0;
  let products = 0;
  for (const pedido of pedidos) {
    if (pedido.idSucursalSurtido !== idSucursal
      || pedido.idSucursal === idSucursal
      || classifyOrder(pedido) !== "neta"
      || (periodo && !inPeriod(pedido.fechaPedido, periodo))) continue;
    count += 1;
    const amount = toCents(saleAmounts(pedido).productos);
    products += amount;
    const saleBranch = String(pedido.idSucursal || "sin_asignar");
    if (!porSucursal[saleBranch]) porSucursal[saleBranch] = { pedidos: 0, productos: 0 };
    porSucursal[saleBranch].pedidos += 1;
    porSucursal[saleBranch].productos += amount;
  }
  return {
    pedidos: count,
    productos: products / 100,
    porSucursal: Object.fromEntries(Object.entries(porSucursal).map(([id, value]) => [
      id,
      { pedidos: value.pedidos, productos: value.productos / 100 },
    ])),
  };
}

function customersIndex(clientes) {
  return new Map(clientes.map((cliente) => [
    cliente.idCliente,
    { tipoCliente: cliente.tipoCliente, tamano: cliente.tamano },
  ]));
}

/** Crea el servicio de reportes de ventas con repositorios sustituibles en pruebas. */
export function createSalesService({
  pedidosRepo,
  clientesRepo,
  conciliacionRepo,
  catalogoRepo = { listProductos },
  sucursalesRepo = { listSucursales },
}) {
  return {
    async getReport(session, { periodo, idSucursal } = {}) {
      requirePermission(session);
      const pedidos = await pedidosRepo.listPedidos(session);
      const [catalogo, sucursales] = await Promise.all([
        catalogoRepo.listProductos(),
        sucursalesRepo.listSucursales(),
      ]);
      const allBranches = session?.alcance === "todas";
      const ownBranch = session?.alcance === "sucursal" ? session.idSucursal : null;
      const reportBranch = allBranches ? idSucursal : ownBranch;
      let index = null;
      if (can(session?.rol, "clientes", "ver")) {
        index = customersIndex(await clientesRepo.listClientes(session));
      }

      const report = buildSalesReport(pedidos, {
        periodo,
        idSucursal: reportBranch,
        clientesIndex: index,
      });
      const productosPorClave = new Map(
        catalogo.map((producto) => [producto.claveProducto, producto.nombre]),
      );
      const porProducto = Object.fromEntries(
        Object.entries(report.porProducto).map(([clave, producto]) => [
          clave,
          { ...producto, nombre: productosPorClave.get(clave) || clave },
        ]),
      );
      return {
        ...report,
        porProducto,
        sucursales,
        reconciliacion: reconcileReport(report),
        periodosDisponibles: availablePeriods(pedidos),
        surtidasParaOtras: ownBranch
          ? getSurtidasParaOtras(pedidos, ownBranch, periodo)
          : null,
      };
    },

    async getReconciliation(session) {
      requirePermission(session);
      return conciliacionRepo.getConciliacion(session);
    },
  };
}

export const salesService = createSalesService({
  pedidosRepo: { listPedidos },
  clientesRepo: { listClientes },
  conciliacionRepo: { getConciliacion },
});
