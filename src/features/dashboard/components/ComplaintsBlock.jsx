import PanelBlock from "./PanelBlock.jsx";

function formatMedian(minutes) {
  if (minutes == null || !Number.isFinite(minutes)) return "Sin respuestas registradas";
  const totalMinutes = Math.round(minutes);
  const hours = Math.floor(totalMinutes / 60);
  const remainder = totalMinutes % 60;
  return [hours ? `${hours} h` : "", remainder ? `${remainder} min` : ""]
    .filter(Boolean)
    .join(" ") || "Menos de 1 min";
}

export default function ComplaintsBlock({ block, detailLinks }) {
  if (block?.estado !== "ok") {
    return <PanelBlock title="Quejas" block={block} detailLinks={detailLinks} />;
  }
  const data = block.datos;
  return (
    <PanelBlock title="Quejas" block={block} detailLinks={detailLinks}>
      <p className="panel-highlight">
        Primera respuesta en 15 minutos: {data.primeraRespuesta.porcentaje}% (
        {data.primeraRespuesta.cumplen15} de {data.primeraRespuesta.conRespuesta})
      </p>
      <dl className="panel-metrics">
        <div><dt>Mediana de respuesta</dt><dd>{formatMedian(data.primeraRespuesta.medianaMinutos)}</dd></div>
        <div><dt>Casos repetidos</dt><dd>{data.casosRepetidos}</dd></div>
        <div><dt>Vencidas sin respuesta</dt><dd>{data.vencidasSinRespuesta}</dd></div>
        <div><dt>Acuses automáticos del asistente</dt><dd>{data.acusesAutomaticos}</dd></div>
      </dl>
      <p className="panel-assumption">Línea base del caso: respuestas humanas en minutos corridos.</p>
    </PanelBlock>
  );
}
