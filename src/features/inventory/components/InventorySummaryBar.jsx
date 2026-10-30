import { formatDateTime } from "../../../shared/utils/format.js";

const METRICS = [
  ["Productos", (summary) => summary.productos],
  ["Agotados", (summary) => summary.agotados],
  ["Stock bajo", (summary) => summary.bajos],
  ["Normales", (summary) => summary.normales],
  ["Exceso", (summary) => summary.exceso],
];

export default function InventorySummaryBar({ summary }) {
  return (
    <dl className="inventory-summary" aria-label="Resumen de existencias">
      {METRICS.map(([label, getValue]) => (
        <div className="inventory-summary-card" key={label}>
          <dt>{label}</dt>
          <dd aria-live="polite">{getValue(summary).toLocaleString("es-MX")}</dd>
        </div>
      ))}
      <div className="inventory-summary-card inventory-summary-cut">
        <dt>Corte</dt>
        <dd aria-live="polite">{formatDateTime(summary.fechaCorte)}</dd>
      </div>
    </dl>
  );
}
