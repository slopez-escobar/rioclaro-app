import { formatMXN } from "../../../shared/utils/format.js";

const CARDS = [
  ["Pedidos", (summary) => summary.cantidad.toLocaleString("es-MX")],
  ["En curso", (summary) => summary.enCurso.toLocaleString("es-MX")],
  ["Entregados", (summary) => summary.entregados.toLocaleString("es-MX")],
  ["Cancelados", (summary) => summary.cancelados.toLocaleString("es-MX")],
  ["Devueltos", (summary) => summary.devueltos.toLocaleString("es-MX")],
  ["Ventas confirmadas (sin cancelados)", (summary) => formatMXN(summary.ventasConfirmadasMXN)],
];

export default function OrderSummary({ summary }) {
  return (
    <dl className="pedidos-summary" aria-label="Resumen de pedidos dentro de tu alcance">
      {CARDS.map(([label, value]) => (
        <div className="pedidos-summary-card" key={label}>
          <dt>{label}</dt>
          <dd aria-live="polite">{value(summary)}</dd>
        </div>
      ))}
      <div className="pedidos-summary-breakdown">
        <dt>Desglose de todos los pedidos dentro del alcance</dt>
        <dd>
          <span>Productos: {formatMXN(summary.subtotalProductos)}</span>
          <span>Envío: {formatMXN(summary.costoEnvio)}</span>
          <span>Subtotal (incluye envío): {formatMXN(summary.subtotal)}</span>
          <span>IVA: {formatMXN(summary.iva)}</span>
          <strong>Total general: {formatMXN(summary.total)}</strong>
        </dd>
      </div>
    </dl>
  );
}
