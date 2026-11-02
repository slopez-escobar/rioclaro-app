import { isLowConfidence } from "./confidenceThresholds.js";
import { normalizeRfc } from "./normalize.js";

const REQUIRED_FIELDS = [
  { key: "proveedor", missing: "Falta el proveedor" },
  { key: "rfc", missing: "Falta el RFC" },
  { key: "folio", missing: "Falta el folio" },
  { key: "fecha", missing: "Falta la fecha" },
  { key: "total", missing: "Falta el total" },
];

const CONFIDENCE_FIELDS = [
  { key: "folio", label: "folio" },
  { key: "fecha", label: "fecha" },
  { key: "total", label: "total" },
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
 * @returns {{estado: "OK"|"Revisar", motivos: string[], proveedorId: string|null, razonSocial: string|null}} Resultado de validación.
 */
export function validateInvoice(extraccion, { proveedores = [] } = {}) {
  const motivos = [];

  for (const field of REQUIRED_FIELDS) {
    const extracted = extraccion?.[field.key];
    if (isMissing(extracted?.valor)) motivos.push(field.missing);
  }

  for (const field of CONFIDENCE_FIELDS) {
    const extracted = extraccion?.[field.key];
    const confidence = extracted?.confianza;
    if (
      typeof confidence !== "number"
      || !Number.isFinite(confidence)
      || isLowConfidence(field.key, confidence)
    ) {
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
    razonSocial: proveedor?.razonSocial ?? null,
  };
}
