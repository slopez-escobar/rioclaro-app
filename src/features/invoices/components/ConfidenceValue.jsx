import { thresholdFor, isLowConfidence } from "../domain/confidenceThresholds.js";
import "./invoice-components.css";

/**
 * Muestra un dato extraído y advierte si su confianza es baja.
 * @param {{campo: Object, field: string, formato?: Function}} props Campo, identificador y formateador opcional.
 * @returns {import("react").JSX.Element} Valor con su indicador de confianza.
 */
export default function ConfidenceValue({ campo, field, formato, validadoPorCatalogo = false }) {
  const extraction = campo !== null && typeof campo === "object" && Object.hasOwn(campo, "valor")
    ? campo
    : { valor: campo, confianza: null };
  const value = extraction.valor === null || extraction.valor === undefined || extraction.valor === ""
    ? "—"
    : formato
      ? formato(extraction.valor)
      : String(extraction.valor);
  const lowConfidence = !validadoPorCatalogo && typeof extraction.confianza === "number"
    && isLowConfidence(field, extraction.confianza);
  const confidencePercent = typeof extraction.confianza === "number" && Number.isFinite(extraction.confianza)
    ? Math.round(extraction.confianza * 100)
    : null;
  const threshold = thresholdFor(field);
  const minimumPercent = threshold === null ? null : Math.round(threshold * 100);

  return (
    <span
      className={`factura-confidence${lowConfidence ? " baja" : ""}`}
      title={validadoPorCatalogo
        ? "Validado por catálogo"
        : confidencePercent === null
          ? undefined
          : minimumPercent === null
            ? `Confianza ${confidencePercent}%`
            : `Confianza ${confidencePercent}% (mínimo ${minimumPercent}%)`}
    >
      {value}
      {validadoPorCatalogo ? (
        <span className="factura-confidence-catalogo">Validado por catálogo</span>
      ) : null}
      {lowConfidence ? <span className="factura-sr-only"> confianza baja</span> : null}
    </span>
  );
}
