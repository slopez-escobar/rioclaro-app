import { DIRECTION_APPROVAL_THRESHOLD } from "../../../config/constants.js";
import { normalizeAmount } from "./normalize.js";
import { standardName } from "./standardName.js";

/**
 * Extrae el valor de una propiedad detectada sin alterar su representación.
 * @param {*} field Valor directo o envoltura con propiedad valor.
 * @returns {*} Valor extraído.
 */
function getValue(field) {
  return field !== null && typeof field === "object" && Object.hasOwn(field, "valor")
    ? field.valor
    : field ?? null;
}

/**
 * Construye un registro de factura con identificadores y fecha de subida explícitos.
 * @param {Object} input Datos de extracción, archivo y evaluación.
 * @returns {Object} Registro persistible de factura.
 */
export function createInvoiceRecord({ id, extraccion, archivo, evaluacion, subidaPor, subidaEn }) {
  const nombreArchivo = typeof archivo === "string" ? archivo : archivo?.nombre ?? null;
  const hash = typeof archivo === "object" && archivo !== null ? archivo.hash ?? null : null;
  const rfc = getValue(extraccion?.rfc);
  const folio = getValue(extraccion?.folio);
  const fecha = getValue(extraccion?.fecha);
  const total = getValue(extraccion?.total);
  const totalNumerico = normalizeAmount(total);

  return {
    id,
    archivo: nombreArchivo,
    nombreEstandar: standardName({ archivo: nombreArchivo, rfc, folio, fecha }),
    hash,
    subidaEn,
    subidaPor,
    proveedor: getValue(extraccion?.proveedor),
    rfc,
    folio,
    fecha,
    total,
    confianza: Object.fromEntries(
      ["proveedor", "rfc", "folio", "fecha", "total"].map((field) => [
        field,
        extraccion?.[field]?.confianza ?? null,
      ]),
    ),
    estado: evaluacion.estado,
    motivos: [...evaluacion.motivos],
    duplicadoDe: evaluacion.duplicadoDe ? { ...evaluacion.duplicadoDe } : null,
    proveedorId: evaluacion.proveedorId,
    requiereDireccion: totalNumerico !== null && totalNumerico > DIRECTION_APPROVAL_THRESHOLD,
    aprobaciones: [],
    historial: [],
    decididaPor: null,
    decididaEn: null,
  };
}
