import { isOrderInProgress } from "./orderLabels.js";

function cents(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? Math.round((amount + Number.EPSILON) * 100)
    : 0;
}

function pesos(value) {
  return value / 100;
}

/**
 * Agrega importes ya calculados en cada pedido evitando errores acumulados de coma flotante.
 */
export function calculateOrderTotals(orders) {
  const amounts = {
    subtotalProductos: 0,
    costoEnvio: 0,
    subtotal: 0,
    iva: 0,
    total: 0,
    ventasConfirmadasMXN: 0,
  };
  const porEstado = {};

  for (const order of orders) {
    const resumen = order.resumen || {};
    amounts.subtotalProductos += cents(resumen.subtotalProductos);
    amounts.costoEnvio += cents(resumen.costoEnvio);
    amounts.subtotal += cents(resumen.subtotal);
    amounts.iva += cents(resumen.iva?.importe);
    amounts.total += cents(resumen.total);
    if (order.estado !== "cancelado") {
      amounts.ventasConfirmadasMXN += cents(resumen.total);
    }
    porEstado[order.estado] = (porEstado[order.estado] || 0) + 1;
  }

  return {
    cantidad: orders.length,
    enCurso: orders.filter((order) => isOrderInProgress(order.estado)).length,
    entregados: porEstado.entregado || 0,
    cancelados: porEstado.cancelado || 0,
    devueltos: porEstado.devuelto || 0,
    porEstado,
    subtotalProductos: pesos(amounts.subtotalProductos),
    costoEnvio: pesos(amounts.costoEnvio),
    subtotal: pesos(amounts.subtotal),
    iva: pesos(amounts.iva),
    total: pesos(amounts.total),
    ventasConfirmadasMXN: pesos(amounts.ventasConfirmadasMXN),
  };
}
