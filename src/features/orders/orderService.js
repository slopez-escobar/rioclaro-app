import { can } from "../auth/permissions.js";
import {
  getPedido,
  listPedidos,
} from "../../data/repositories/pedidosRepository.js";
import {
  getMiCliente,
  listClientes,
} from "../../data/repositories/clientesRepository.js";
import {
  getCatalogoPedidos,
} from "../../data/repositories/catalogoPedidosRepository.js";
import { listSucursales } from "../../data/repositories/sucursalesRepository.js";
import { filterOrders } from "./domain/orderFilters.js";
import { getDeliveryLabel, getOrderStateLabel, getPaymentLabel } from "./domain/orderLabels.js";
import { calculateOrderTotals } from "./domain/orderTotals.js";

function customerName(customer) {
  return customer?.nombreComercial
    || customer?.razonSocial
    || customer?.nombre
    || null;
}

async function lookupData(session, orders, catalog) {
  const branches = listSucursales();
  let customers = [];
  if (can(session?.rol, "clientes", "ver")) {
    customers = await listClientes(session);
  } else if (session?.alcance === "propio") {
    const customer = await getMiCliente(session);
    if (customer) customers = [customer];
  }
  const customersById = new Map(customers.map((item) => [item.idCliente, item]));
  const branchesById = new Map(branches.map((item) => [item.id, item]));
  const states = catalog.estadosPedido || [];

  return orders.map((order) => {
    const customer = customersById.get(order.idCliente);
    const branch = branchesById.get(order.idSucursal);
    const supplyingBranch = branchesById.get(order.idSucursalSurtido);
    const pickupBranch = branchesById.get(order.sucursalRecoleccion);
    return {
      ...order,
      clienteNombre: customerName(customer),
      sucursalNombre: branch?.ciudad || branch?.nombre || order.idSucursal,
      sucursalSurtidoNombre: supplyingBranch?.ciudad
        || supplyingBranch?.nombre
        || order.idSucursalSurtido
        || "Sin asignar",
      sucursalRecoleccionNombre: pickupBranch?.ciudad
        || pickupBranch?.nombre
        || order.sucursalRecoleccion
        || null,
      estadoLabel: getOrderStateLabel(order.estado, states),
      estadoEvents: (order.historialEstados || []).map((event) => ({
        ...event,
        label: getOrderStateLabel(event.estado, states),
      })),
      pagoLabel: getPaymentLabel(order.pago?.estatus),
      tipoEntregaLabel: getDeliveryLabel(order.tipoEntrega),
    };
  });
}

/**
 * Lista pedidos visibles, con totalizadores sin filtrar y resultados filtrados.
 */
export async function getOrdersData(session, filters = {}) {
  const [visible, catalog] = await Promise.all([
    listPedidos(session),
    getCatalogoPedidos(),
  ]);
  const orders = await lookupData(session, visible, catalog);
  const filtered = filterOrders(orders, filters);
  return {
    orders: filtered,
    summary: calculateOrderTotals(orders),
    sucursales: listSucursales(),
    estados: catalog.estadosPedido || [],
    cantidadFiltrada: filtered.length,
  };
}

/**
 * Resume pedidos visibles y los surtidos desde otra sucursal.
 */
export async function getOrderSummary(session) {
  const orders = await listPedidos(session);
  const saleOrders = session?.alcance === "sucursal"
    ? orders.filter((order) => order.idSucursal === session.idSucursal)
    : orders;
  return {
    ...calculateOrderTotals(orders),
    surtidosDesdeOtraSucursal: saleOrders.filter((order) =>
      order.idSucursalSurtido
      && order.idSucursal
      && order.idSucursalSurtido !== order.idSucursal).length,
  };
}

/**
 * Obtiene el detalle solo si el pedido pertenece al alcance autorizado.
 */
export async function getOrderDetail(session, idOFolio) {
  const [order, catalog] = await Promise.all([
    getPedido(session, idOFolio),
    getCatalogoPedidos(),
  ]);
  if (!order) return null;
  return (await lookupData(session, [order], catalog))[0];
}

export const orderService = { summary: getOrderSummary };
