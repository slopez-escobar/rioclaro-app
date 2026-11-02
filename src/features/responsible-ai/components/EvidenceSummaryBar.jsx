export default function EvidenceSummaryBar({ checks, results, running, progress }) {
  const counts = {
    local: checks.filter((check) => check.tipo === "local").length,
    pasa: results.filter((result) => result.estado === "pasa").length,
    falla: results.filter((result) => result.estado === "falla").length,
    pendiente: checks.filter((check) => check.tipo === "pendiente").length,
    manual: checks.filter((check) => check.tipo === "manual").length,
  };
  return (
    <section className="rai-summary" aria-label="Resumen de comprobaciones" aria-live="polite">
      <div>
        <strong>{checks.length} comprobaciones</strong>
        <span>{counts.local} locales · {counts.pendiente} pendientes en Azure · {counts.manual} revisión manual</span>
      </div>
      <dl>
        <div><dt>Aprobadas</dt><dd>{counts.pasa}</dd></div>
        <div><dt>Con atención</dt><dd>{counts.falla}</dd></div>
        <div><dt>Pendientes Azure</dt><dd>{counts.pendiente}</dd></div>
        <div><dt>Manuales</dt><dd>{counts.manual}</dd></div>
      </dl>
      {running ? <p role="status">{progress}</p> : null}
    </section>
  );
}
