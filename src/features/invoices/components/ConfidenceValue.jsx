import { CONFIDENCE_THRESHOLD } from "../../../config/constants.js";
import "./invoice-components.css";

/**
 * Muestra un dato extraído y advierte si su confianza es baja.
 * @param {{campo: Object, formato?: Function}} props Campo y formateador opcional.
 * @returns {import("react").JSX.Element} Valor con su indicador de confianza.
 */
export default function ConfidenceValue({ campo, formato }) {
  const extraction = campo !== null && typeof campo === "object" && Object.hasOwn(campo, "valor")
    ? campo
    : { valor: campo, confianza: null };
  const value = extraction.valor === null || extraction.valor === undefined || extraction.valor === ""
    ? "—"
    : formato
      ? formato(extraction.valor)
      : String(extraction.valor);
  const lowConfidence = typeof extraction.confianza === "number"
    && extraction.confianza < CONFIDENCE_THRESHOLD;
  const confidencePercent = typeof extraction.confianza === "number"
    ? Math.round(extraction.confianza * 100)
    : null;

  return (
    <span
      className={`factura-confidence${lowConfidence ? " baja" : ""}`}
      title={confidencePercent === null ? undefined : `Confianza ${confidencePercent}%`}
    >
      {value}
      {lowConfidence ? <span className="factura-sr-only"> confianza baja</span> : null}
    </span>
  );
}
