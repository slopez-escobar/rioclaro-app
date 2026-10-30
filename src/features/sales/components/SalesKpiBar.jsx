import { formatMXN } from "../../../shared/utils/format.js";

export default function SalesKpiBar({ totales }) {
  const cards = [
    ["Ventas netas (sin IVA)", formatMXN(totales.netas.productos)],
    ["Envío", formatMXN(totales.netas.envio)],
    ["IVA", formatMXN(totales.netas.iva)],
    ["Total con IVA", formatMXN(totales.netas.total)],
    ["Devoluciones", `${formatMXN(totales.devueltas.total)} · ${totales.devueltas.pedidos.toLocaleString("es-MX")} pedidos`],
    ["Cancelados", `${formatMXN(totales.canceladas.total)} · ${totales.canceladas.pedidos.toLocaleString("es-MX")} pedidos`],
  ];
  return (
    <dl className="sales-kpis" aria-label="Indicadores de ventas" aria-live="polite">
      {cards.map(([label, value]) => (
        <div className="sales-kpi" key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
