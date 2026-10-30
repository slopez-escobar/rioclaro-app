function formatMedian(minutes) {
  if (!Number.isFinite(minutes)) return "—";
  const roundedMinutes = Math.round(minutes);
  const hours = Math.floor(roundedMinutes / 60);
  const remainder = roundedMinutes % 60;
  return `${hours} h ${remainder} min`;
}

/**
 * Presenta los indicadores visibles de atención de quejas.
 * @param {{kpis:Object}} props Indicadores del servicio de quejas.
 * @returns {import("react").JSX.Element} Resumen semántico de indicadores.
 */
export default function ComplaintKpiBar({ kpis }) {
  const statusItems = [
    ["Quejas", kpis.total],
    ["Abiertas", kpis.porEstatus.abierta],
    ["En atención", kpis.porEstatus.en_atencion],
    ["Escaladas", kpis.porEstatus.escalada],
    ["Resueltas", kpis.porEstatus.resuelta],
    ["Cerradas", kpis.porEstatus.cerrada],
    ["Casos repetidos", kpis.casosRepetidos],
  ];
  return (
    <section className="quejas-kpis" aria-label="Indicadores de quejas">
      <dl className="quejas-kpi-grid">
        {statusItems.map(([label, value]) => (
          <div className="quejas-kpi-card" key={label}>
            <dt>{label}</dt>
            <dd aria-live="polite">{value}</dd>
          </div>
        ))}
        <div className="quejas-kpi-card quejas-kpi-primary">
          <dt>
            Primera respuesta en 15 minutos:{" "}
            <span aria-live="polite">
              {kpis.primeraRespuesta.porcentaje}% ({kpis.primeraRespuesta.cumplen15}
              {" "}de {kpis.primeraRespuesta.conRespuesta})
            </span>
          </dt>
          <dd aria-live="polite">Mediana: {formatMedian(kpis.primeraRespuesta.medianaMinutos)}</dd>
          <p>Línea base del caso: respuestas humanas medidas en minutos corridos</p>
        </div>
        <div className="quejas-kpi-card">
          <dt>Acuses inmediatos del asistente</dt>
          <dd aria-live="polite">{kpis.acusesAutomaticos}</dd>
        </div>
        <div className="quejas-kpi-card">
          <dt>Vencidas sin respuesta</dt>
          <dd aria-live="polite">{kpis.vencidasSinRespuesta}</dd>
        </div>
      </dl>
    </section>
  );
}
