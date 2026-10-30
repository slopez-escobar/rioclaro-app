import { formatMXN } from "../../shared/utils/format.js";

/** Presenta AAAA-MM en español de México. */
export function formatSalesPeriod(period) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(period ?? ""));
  if (!match) return String(period ?? "");
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  if (date.getUTCMonth() + 1 !== Number(match[2])) return String(period);
  return new Intl.DateTimeFormat("es-MX", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Calcula el porcentaje de un importe respecto de un total válido. */
export function salesPercentage(value, total) {
  return Number.isFinite(value) && Number.isFinite(total) && total > 0
    ? Math.max(0, Math.min(100, (value / total) * 100))
    : 0;
}

/** Traduce los desgloses de conciliación a una explicación breve en español. */
export function formatReconciliationBreakdown(hipotesis, desglose = {}) {
  if (hipotesis === "incluye_cancelados") {
    return `Incluye ${formatMXN(desglose.canceladosIncluidos || 0)} de pedidos cancelados`;
  }
  if (hipotesis === "por_fecha_de_entrega") {
    return `${formatMXN(desglose.entregadosEnElPeriodoDePedidosDeOtroMes || 0)} de entregas de pedidos de otro mes; ${formatMXN(desglose.pedidosDelPeriodoNoEntregadosEnElPeriodo || 0)} de pedidos netos aún no entregados en el mes`;
  }
  if (hipotesis === "por_sucursal_que_surte") {
    return `${formatMXN(desglose.ventasDeOtrasSucursalesSurtidasPorEstaSucursal || 0)} de otras sucursales; ${formatMXN(desglose.ventasDeEstaSucursalSurtidasPorOtras || 0)} de esta sucursal surtidos en otras`;
  }
  if (hipotesis === "con_iva") {
    return `Incluye ${formatMXN(desglose.ivaDeProductos || 0)} de IVA`;
  }
  if (hipotesis === "incluye_devueltos") {
    return `No resta ${formatMXN(desglose.devolucionesIncluidas || 0)} de devoluciones`;
  }
  return "Sin explicación";
}
