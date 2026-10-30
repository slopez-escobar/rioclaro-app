import { CONFIDENCE_THRESHOLD } from "../../../config/constants.js";
import { normalizeRfc } from "./normalize.js";

const REQUIRED_FIELDS = [
  { key: "proveedor", label: "proveedor", missing: "Falta el proveedor" },
  { key: "rfc", label: "RFC", missing: "Falta el RFC" },
  { key: "folio", label: "folio", missing: "Falta el folio" },
  { key: "fecha", label: "fecha", missing: "Falta la fecha" },
  { key: "total", label: "total", missing: "Falta el total" },
];

/**
 * Indica si un valor requerido no fue extraído.
 * @param {*} value Valor extraído.
 * @returns {boolean} Verdadero cuando el valor está vacío.
 */
function isMissing(value) {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

/**
 * Valida los campos extraídos y el registro del proveedor.
 * @param {Object} extraccion Campos extraídos con valor y confianza.
 * @param {Object} options Catálogo de proveedores.
 * @returns {{estado: "OK"|"Revisar", motivos: string[], proveedorId: string|null}} Resultado de validación.
 */
export function validateInvoice(extraccion, { proveedores = [] } = {}) {
  const motivos = [];

  for (const field of REQUIRED_FIELDS) {
    const extracted = extraccion?.[field.key];
    if (isMissing(extracted?.valor)) motivos.push(field.missing);
    const confidence = extracted?.confianza;
    if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < CONFIDENCE_THRESHOLD) {
      const percent = typeof confidence === "number" && Number.isFinite(confidence)
        ? Math.round(confidence * 100)
        : 0;
      motivos.push(`Confianza baja en ${field.label}: ${percent}%`);
    }
  }

  const rfc = normalizeRfc(extraccion?.rfc?.valor);
  const proveedor = rfc
    ? proveedores.find((item) => normalizeRfc(item?.rfc) === rfc)
    : null;
  const proveedorId = proveedor?.idProveedor == null ? null : String(proveedor.idProveedor);

  if (rfc && !proveedor) {
    motivos.push(`Proveedor no registrado: el RFC ${rfc} no existe en el catálogo de proveedores`);
  }

  return {
    estado: motivos.length === 0 ? "OK" : "Revisar",
    motivos,
    proveedorId,
  };
}
