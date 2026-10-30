import { normalizeAmount, normalizeFolio, normalizeRfc } from "./normalize.js";

/**
 * Obtiene el valor directo o el contenido de un campo extraído.
 * @param {*} field Valor directo o envoltura con propiedad valor.
 * @returns {*} Valor contenido.
 */
function getValue(field) {
  return field !== null && typeof field === "object" && Object.hasOwn(field, "valor")
    ? field.valor
    : field;
}

/**
 * Obtiene el nombre del archivo de un registro.
 * @param {*} archivo Nombre u objeto del archivo.
 * @returns {string|null} Nombre de archivo.
 */
function getFileName(archivo) {
  if (typeof archivo === "string") return archivo;
  if (archivo && typeof archivo.nombre === "string") return archivo.nombre;
  return null;
}

/**
 * Selecciona la coincidencia más antigua usando subidaEn o, si falta, el orden recibido.
 * @param {Object[]} coincidencias Coincidencias con índice de entrada.
 * @returns {Object|null} Coincidencia más antigua.
 */
function oldestMatch(coincidencias) {
  if (coincidencias.length === 0) return null;
  return coincidencias.reduce((oldest, candidate) => {
    const date = Date.parse(candidate.existing?.subidaEn);
    const oldestDate = Date.parse(oldest.existing?.subidaEn);
    if (Number.isFinite(date) && Number.isFinite(oldestDate) && date !== oldestDate) {
      return date < oldestDate ? candidate : oldest;
    }
    return candidate.index < oldest.index ? candidate : oldest;
  });
}

/**
 * Busca la factura previa más antigua que coincide por hash o por datos.
 * @param {Object} factura Factura actual.
 * @param {Object[]} existentes Facturas ya procesadas en orden cronológico.
 * @returns {{duplicada: boolean, tipo: "hash"|"datos"|null, de: {id: *, archivo: string|null}|null}} Coincidencia encontrada.
 */
export function detectDuplicate(factura, existentes = []) {
  const hash = getValue(factura?.hash);
  const rfc = normalizeRfc(getValue(factura?.rfc));
  const folio = normalizeFolio(getValue(factura?.folio));
  const total = normalizeAmount(getValue(factura?.total));
  const coincidencias = [];

  existentes.forEach((existente, index) => {
    const existingHash = getValue(existente?.hash);
    if (hash && existingHash && hash === existingHash) {
      coincidencias.push({ existing: existente, index, tipo: "hash" });
      return;
    }

    if (rfc && folio && total !== null) {
      const existingRfc = normalizeRfc(getValue(existente?.rfc));
      const existingFolio = normalizeFolio(getValue(existente?.folio));
      const existingTotal = normalizeAmount(getValue(existente?.total));
      if (
        existingRfc === rfc
        && existingFolio === folio
        && existingTotal !== null
        && Math.abs(existingTotal - total) < 0.005
      ) {
        coincidencias.push({ existing: existente, index, tipo: "datos" });
      }
    }
  });

  const match = oldestMatch(coincidencias);
  if (match) {
    return {
      duplicada: true,
      tipo: match.tipo,
      de: { id: match.existing.id ?? null, archivo: getFileName(match.existing.archivo) },
    };
  }

  return { duplicada: false, tipo: null, de: null };
}

/**
 * Busca un folio previo del mismo proveedor con un importe diferente.
 * @param {Object} factura Factura actual.
 * @param {Object[]} existentes Facturas ya procesadas en orden cronológico.
 * @returns {{repetido: boolean, de: {id: *, archivo: string|null, total: number}|null}} Coincidencia encontrada.
 */
export function findRepeatedFolio(factura, existentes = []) {
  const rfc = normalizeRfc(getValue(factura?.rfc));
  const folio = normalizeFolio(getValue(factura?.folio));
  const total = normalizeAmount(getValue(factura?.total));

  if (!rfc || !folio || total === null) return { repetido: false, de: null };

  const coincidencias = [];
  existentes.forEach((existente, index) => {
    const existingRfc = normalizeRfc(getValue(existente?.rfc));
    const existingFolio = normalizeFolio(getValue(existente?.folio));
    const existingTotal = normalizeAmount(getValue(existente?.total));
    if (
      existingRfc === rfc
      && existingFolio === folio
      && existingTotal !== null
      && Math.abs(existingTotal - total) >= 0.005
    ) {
      coincidencias.push({ existing: existente, index, total: existingTotal });
    }
  });

  const match = oldestMatch(coincidencias);
  if (match) {
    return {
      repetido: true,
      de: {
        id: match.existing.id ?? null,
        archivo: getFileName(match.existing.archivo),
        total: match.total,
      },
    };
  }

  return { repetido: false, de: null };
}
