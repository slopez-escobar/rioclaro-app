// La venta son productos sin IVA; envío e IVA se reportan aparte. Las netas excluyen cancelados y devueltos.
const toCents = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? Math.round((amount + Number.EPSILON) * 100)
    : 0;
};

const fromCents = (value) => value / 100;

/** Clasifica el pedido para el reporte de ventas. */
export function classifyOrder(pedido) {
  if (pedido?.estado === "cancelado") return "cancelado";
  if (pedido?.estado === "devuelto") return "devuelto";
  return "neta";
}

/** Separa importes de producto, envío, IVA y total de un pedido. */
export function saleAmounts(pedido) {
  const resumen = pedido?.resumen || {};
  return {
    productos: fromCents(toCents(resumen.subtotalProductos)),
    envio: fromCents(toCents(resumen.costoEnvio)),
    iva: fromCents(toCents(resumen.iva?.importe)),
    total: fromCents(toCents(resumen.total)),
  };
}

/** Indica si una fecha pertenece al mes AAAA-MM solicitado. */
export function inPeriod(fecha, periodo) {
  return /^\d{4}-\d{2}$/.test(String(periodo ?? ""))
    && String(fecha ?? "").slice(0, 7) === periodo;
}

export { fromCents, toCents };
