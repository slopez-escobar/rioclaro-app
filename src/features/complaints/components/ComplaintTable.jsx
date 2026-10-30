import { formatDateTime } from "../../../shared/utils/format.js";
import Tag from "../../../shared/ui/Tag.jsx";

const THEME_LABELS = {
  sin_existencia: "Falta de existencia",
  error_de_captura: "Error de captura",
  entrega_fallida: "Entrega fallida",
  cobro_duplicado: "Cobro duplicado",
  cancelacion_solicitada: "Cancelación solicitada",
  sin_clasificar: "Sin clasificar",
};
const STATUS_LABELS = {
  abierta: "Abierta",
  en_atencion: "En atención",
  escalada: "Escalada",
  resuelta: "Resuelta",
  cerrada: "Cerrada",
};

function formatElapsed(minutes) {
  if (!Number.isFinite(minutes)) return "—";
  const whole = Math.floor(minutes);
  const hours = Math.floor(whole / 60);
  const remainder = whole % 60;
  return hours ? `${hours} h ${remainder} min` : `${remainder} min`;
}

function firstResponseLabel(response) {
  if (response.estado === "cumplida") return `✓ ${formatElapsed(response.minutos)}`;
  if (response.estado === "incumplida") return `✗ ${formatElapsed(response.minutos)}`;
  if (response.estado === "en_tiempo") return `En tiempo · ${formatElapsed(response.minutos)}`;
  return `Vencida · ${formatElapsed(response.minutos)}`;
}

/**
 * Tabla seleccionable y desplazable de quejas.
 * @param {Object} props Quejas, selección y callbacks.
 * @returns {import("react").JSX.Element} Tabla de resultados.
 */
export default function ComplaintTable({ quejas, onSelect, selectedId }) {
  if (!quejas.length) {
    return <p className="quejas-empty">No hay quejas con estos filtros.</p>;
  }
  return (
    <div className="quejas-table-scroll" role="region" aria-label="Lista de quejas" tabIndex={0}>
      <table className="quejas-table">
        <caption>Quejas de clientes</caption>
        <thead>
          <tr>
            <th scope="col">Folio</th>
            <th scope="col">Fecha</th>
            <th scope="col">Cliente</th>
            <th scope="col">Tema</th>
            <th scope="col">Prioridad</th>
            <th scope="col">Sentimiento</th>
            <th scope="col">Estatus</th>
            <th scope="col">Primera respuesta</th>
            <th scope="col">Indicadores</th>
          </tr>
        </thead>
        <tbody>
          {quejas.map((queja) => {
            const sentiment = queja.sentimiento?.sentimiento;
            const sentimentText = sentiment === "negativo" ? "☹ Negativo"
              : sentiment === "positivo" ? "☺ Positivo" : "● Neutral";
            return (
              <tr
                key={queja.idQueja}
                className="quejas-row"
                tabIndex={0}
                aria-selected={selectedId === queja.idQueja}
                onClick={() => onSelect(queja.idQueja)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(queja.idQueja);
                  }
                }}
              >
                <th scope="row">{queja.folio}</th>
                <td>{formatDateTime(queja.fechaQueja)}</td>
                <td>{queja.clienteNombre || queja.idCliente}</td>
                <td>{THEME_LABELS[queja.tema] || queja.tema}</td>
                <td>
                  <Tag variant={queja.prioridad === "alta" ? "rechazada" : queja.prioridad === "media" ? "revisar" : "ok"}>
                    {queja.prioridad[0].toLocaleUpperCase("es-MX") + queja.prioridad.slice(1)}
                  </Tag>
                </td>
                <td>
                  <Tag variant={sentiment === "negativo" ? "rechazada" : sentiment === "positivo" ? "ok" : "info"}>
                    {sentimentText}
                  </Tag>
                </td>
                <td><Tag variant={queja.estatus === "cerrada" ? "ok" : queja.estatus === "escalada" ? "revisar" : "info"}>{STATUS_LABELS[queja.estatus] || queja.estatus}</Tag></td>
                <td>{firstResponseLabel(queja.primeraRespuesta)}</td>
                <td className="quejas-badges">
                  {queja.casoRepetido ? <span className="quejas-badge">Caso repetido</span> : null}
                  {queja.surtidoEnOtraSucursal ? <span className="quejas-badge">Otra sucursal</span> : null}
                  {queja.acuseAutomatico ? <span className="quejas-badge">Asistente</span> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
