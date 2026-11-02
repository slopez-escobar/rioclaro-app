import {
  CONFIDENCE_THRESHOLD,
  FIELD_CONFIDENCE_THRESHOLDS,
} from "../../../config/constants.js";

const CATALOG_VALIDATED_FIELDS = new Set(["proveedor", "rfc"]);

/**
 * Devuelve el umbral calibrado del campo o el valor por defecto.
 * @param {string} campo Identificador del campo extraído.
 * @returns {number|null} Umbral de confianza o null cuando el campo se valida por catálogo.
 */
export function thresholdFor(campo) {
  if (CATALOG_VALIDATED_FIELDS.has(campo)) return null;
  return Object.hasOwn(FIELD_CONFIDENCE_THRESHOLDS, campo)
    ? FIELD_CONFIDENCE_THRESHOLDS[campo]
    : CONFIDENCE_THRESHOLD;
}

/**
 * Indica si la confianza está por debajo del umbral aplicable al campo.
 * @param {string} campo Identificador del campo extraído.
 * @param {number} confianza Confianza devuelta por el extractor.
 * @returns {boolean} Verdadero cuando la confianza es baja.
 */
export function isLowConfidence(campo, confianza) {
  const threshold = thresholdFor(campo);
  return threshold !== null && confianza < threshold;
}
