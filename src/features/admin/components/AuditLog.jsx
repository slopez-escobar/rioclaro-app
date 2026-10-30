const ACTION_LABELS = {
  cuenta_desactivada: "Cuenta desactivada",
  cuenta_reactivada: "Cuenta reactivada",
  asistente_apagado: "Asistente apagado",
  asistente_encendido: "Asistente encendido",
};

function displayDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("es-MX");
}

export default function AuditLog({ entries }) {
  if (!entries.length) return <p>No hay acciones registradas.</p>;
  return (
    <ol className="admin-audit-log" aria-label="Últimas acciones administrativas">
      {entries.map((entry, index) => (
        <li key={`${entry.fecha}-${entry.usuario}-${entry.accion}-${index}`}>
          <time dateTime={entry.fecha}>{displayDate(entry.fecha)}</time>
          <strong>{entry.nombre} ({entry.usuario})</strong>
          <span>{ACTION_LABELS[entry.accion] || entry.accion}</span>
          <span>A quién: {entry.objetivo}</span>
          {entry.comentario ? <p>Motivo: {entry.comentario}</p> : null}
        </li>
      ))}
    </ol>
  );
}
