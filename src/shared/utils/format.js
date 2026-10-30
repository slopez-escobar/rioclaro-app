// Formato de moneda (MXN) y fechas en español de México.
const moneda = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const fecha = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" });
const fechaHora = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

export const formatMXN = (n) => (typeof n === "number" && Number.isFinite(n) ? moneda.format(n) : "—");

function aFecha(valor) {
  if (!valor) return null;
  const d = typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? new Date(valor + "T00:00:00") : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}
export const formatDate = (v) => { const d = aFecha(v); return d ? fecha.format(d) : "—"; };
export const formatDateTime = (v) => { const d = aFecha(v); return d ? fechaHora.format(d) : "—"; };
