import { can } from "../../features/auth/permissions.js";
import { canSeePedido, getScope } from "../scope.js";
import {
  copy,
  createCachedLoader,
  groupBy,
  matchesText,
} from "./repositoryUtils.js";

const ESTADOS_EN_CURSO = new Set([
  "pendiente_confirmacion",
  "aceptado",
  "en_preparacion",
  "en_ruta",
  "listo_para_recoger",
]);

const loadPedidos = createCachedLoader(
  () => import("@data/source/pedidos.json"),
  (data) => ({
    records: data.pedidos,
    byId: new Map(data.pedidos.flatMap((pedido) => [
      [pedido.idPedido, pedido],
      [pedido.folio, pedido],
    ])),
    byCliente: groupBy(data.pedidos, (pedido) => pedido.idCliente),
    bySucursal: groupBy(data.pedidos, (pedido) => pedido.idSucursal),
    bySucursalSurtido: groupBy(data.pedidos, (pedido) => pedido.idSucursalSurtido),
  }),
);

function requirePermission(session) {
  if (!can(session?.rol, "pedidos", "ver")) {
    throw new Error("No tienes permiso para ver pedidos");
  }
}

function visibleOrders(session, indexes) {
  const scope = getScope(session);
  if (scope.alcance === "todas") return indexes.records;
  if (scope.alcance === "propio") return indexes.byCliente.get(scope.idCliente) || [];
  const orders = new Set([
    ...(indexes.bySucursal.get(scope.idSucursal) || []),
    ...(indexes.bySucursalSurtido.get(scope.idSucursal) || []),
  ]);
  return [...orders];
}

/**
 * Lista copias de pedidos visibles para la sesión y aplica los filtros después del alcance.
 */
export async function listPedidos(session, filtros = {}) {
  requirePermission(session);
  const indexes = await loadPedidos();
  const { estado, idCliente, desde, hasta, tipoEntrega, texto } = filtros;
  return copy(visibleOrders(session, indexes).filter((pedido) => {
    const fecha = String(pedido.fechaPedido || "").slice(0, 10);
    return (estado == null || pedido.estado === estado)
      && (idCliente == null || pedido.idCliente === idCliente)
      && (desde == null || fecha >= desde)
      && (hasta == null || fecha <= hasta)
      && (tipoEntrega == null || pedido.tipoEntrega === tipoEntrega)
      && matchesText(pedido, texto);
  }));
}

/**
 * Busca un pedido por identificador o folio; devuelve null si no es visible.
 */
export async function getPedido(session, idOFolio) {
  requirePermission(session);
  const indexes = await loadPedidos();
  const pedido = indexes.byId.get(idOFolio);
  return pedido && canSeePedido(session, pedido) ? copy(pedido) : null;
}

/**
 * Cuenta los pedidos visibles por estado y agrega el total de pedidos en curso.
 */
export async function countPedidosByEstado(session) {
  requirePermission(session);
  const indexes = await loadPedidos();
  const counts = {};
  for (const pedido of visibleOrders(session, indexes)) {
    counts[pedido.estado] = (counts[pedido.estado] || 0) + 1;
    if (ESTADOS_EN_CURSO.has(pedido.estado)) counts.enCurso = (counts.enCurso || 0) + 1;
  }
  return copy(counts);
}
