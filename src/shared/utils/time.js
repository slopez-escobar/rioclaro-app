/**
 * Formatea una fecha como AAAA-MM-DDTHH:mm usando la zona horaria local.
 * @param {Date} date Fecha que se formateará.
 * @returns {string} Fecha y hora local sin zona horaria.
 */
export function formatLocalMinute(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Calcula minutos transcurridos entre fechas locales y nunca devuelve negativos.
 * @param {string} a Fecha inicial AAAA-MM-DDTHH:mm.
 * @param {string} b Fecha final AAAA-MM-DDTHH:mm.
 * @returns {number} Minutos enteros transcurridos.
 */
export function minutesBetween(a, b) {
  const start = new Date(a).getTime();
  const end = new Date(b).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new Error("La fecha debe tener el formato AAAA-MM-DDTHH:mm");
  }
  return Math.max(0, Math.floor((end - start) / 60000));
}
