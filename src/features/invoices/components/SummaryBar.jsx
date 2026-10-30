import { WEEKLY_MANUAL_HOURS_BASELINE } from "../../../config/constants.js";
import "./invoice-components.css";

const STATUSES = ["OK", "Revisar", "Duplicada", "Aprobada", "Rechazada"];

/**
 * Resume los conteos de facturas y el tiempo humano estimado.
 * @param {{resumen: Object}} props Resumen generado por el servicio de facturas.
 * @returns {import("react").JSX.Element} Resumen semántico de facturas.
 */
export default function SummaryBar({ resumen = {} }) {
  const counts = resumen.porEstado || {};
  const hours = Number(resumen.horasHumanasEstimadas) || 0;
  const baseline = resumen.horasLineaBase ?? WEEKLY_MANUAL_HOURS_BASELINE;
  return (
    <section className="factura-summary" aria-label="Resumen de facturas">
      <dl className="factura-summary-list" aria-live="polite" aria-atomic="true">
        {STATUSES.map((status) => (
          <div className="factura-summary-card" key={status}>
            <dt>{status}</dt>
            <dd>{counts[status] ?? 0}</dd>
          </div>
        ))}
        <div className="factura-summary-card">
          <dt>Pendientes de dirección</dt>
          <dd>{resumen.pendientesDeDireccion ?? 0}</dd>
        </div>
      </dl>
      <p aria-live="polite" aria-atomic="true">
        Tiempo humano estimado: {hours.toFixed(2)} h frente a ~{baseline} h semanales de captura manual
      </p>
      <p className="factura-summary-note">
        Supuesto del prototipo: 3 min por factura en revisión y 1 min por factura aprobada (no es una medición real)
      </p>
    </section>
  );
}
