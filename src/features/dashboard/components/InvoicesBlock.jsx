import PanelBlock from "./PanelBlock.jsx";

export default function InvoicesBlock({ block, detailLinks }) {
  if (block?.estado !== "ok") {
    return <PanelBlock title="Facturas" block={block} detailLinks={detailLinks} />;
  }
  const data = block.datos;
  return (
    <PanelBlock title="Facturas" block={block} detailLinks={detailLinks}>
      <p className="panel-total">{data.total} facturas procesadas</p>
      <dl className="panel-metrics">
        {Object.entries(data.porEstado).map(([state, count]) => (
          <div key={state}><dt>{state}</dt><dd>{count}</dd></div>
        ))}
        <div><dt>{data.lecturaAutomaticaLabel}</dt><dd>{data.leidasSinIntervencion}</dd></div>
        <div><dt>En revisión</dt><dd>{data.enRevision}</dd></div>
        <div><dt>Duplicadas bloqueadas</dt><dd>{data.duplicadasBloqueadas}</dd></div>
        <div><dt>Pendientes de dirección</dt><dd>{data.pendientesDeDireccion}</dd></div>
      </dl>
      <p className="panel-time-estimate">
        Tiempo humano estimado: {data.horasHumanasEstimadas} h frente a ~{data.horasLineaBase} h
        semanales de captura manual ({Math.round(data.porcentajeReduccion)}% menos).
      </p>
      <p className="panel-assumption">{data.nota}</p>
      <p className="panel-assumption">{data.notaLectura}</p>
    </PanelBlock>
  );
}
