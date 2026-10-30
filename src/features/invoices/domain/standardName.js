import { normalizeDate, normalizeRfc } from "./normalize.js";

/**
 * Obtiene el valor directo o el valor de un campo extraído.
 * @param {*} field Valor directo o campo con propiedad valor.
 * @returns {*} Valor contenido.
 */
function getValue(field) {
  return field !== null && typeof field === "object" && Object.hasOwn(field, "valor")
    ? field.valor
    : field;
}

/**
 * Propone el nombre estándar usando datos ya extraídos, sin completarlos.
 * @param {Object} factura Factura con archivo, RFC, folio y fecha.
 * @returns {string|null} Nombre estandarizado o null si faltan datos.
 */
export function standardName(factura) {
  if (!factura || typeof factura !== "object") return null;
  const archivo = typeof factura.archivo === "string"
    ? factura.archivo
    : factura.archivo?.nombre ?? factura.nombre;
  if (typeof archivo !== "string") return null;
  const nombreOriginal = archivo.split(/[\\/]/).pop();
  const extension = /\.([^.]+)$/.exec(nombreOriginal)?.[1]?.toLowerCase();
  const rfc = normalizeRfc(getValue(factura.rfc));
  const folioValue = getValue(factura.folio);
  const folio = folioValue === null || folioValue === undefined
    ? ""
    : String(folioValue).trim().replace(/[\s/\\:*?"<>|]+/g, "-");
  const fecha = normalizeDate(getValue(factura.fecha));

  if (!rfc || !folio || !fecha || !extension) return null;
  return `${rfc}_${folio}_${fecha}.${extension}`;
}
