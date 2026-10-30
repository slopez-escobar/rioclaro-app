import { formatDateTime } from "../../../shared/utils/format.js";
import SourceChip from "./SourceChip.jsx";

export default function MessageBubble({ mensaje, onAction, contact, onComplaint, canCreateComplaint }) {
  const isUser = mensaje.role === "user";
  const isError = mensaje.estado === "error";
  return (
    <article className={`chat-message ${isUser ? "chat-message-user" : "chat-message-assistant"} ${mensaje.estado === "rechazado" ? "chat-message-rejected" : ""}`}>
      <div className="chat-message-label">{isUser ? "Tú" : "Asistente (IA)"}</div>
      <p className="chat-message-text" role={isError ? "alert" : undefined}>{mensaje.texto}</p>
      {!isUser && mensaje.fuentes?.length > 0 ? (
        <div className="chat-sources" aria-label="Fuentes consultadas">
          {mensaje.fuentes.map((source, index) => <SourceChip key={`${source.tipo}-${source.id}-${index}`} fuente={source} />)}
        </div>
      ) : null}
      {!isUser && mensaje.acciones?.length > 0 ? (
        <div className="chat-actions">
          {mensaje.acciones.map((action, index) => (
            action.tipo === "hablar_con_persona"
              ? <button className="btn btn-secondary" key={`${action.tipo}-${index}`} onClick={() => onAction?.(contact)}>Hablar con una persona</button>
              : action.tipo === "registrar_queja" && canCreateComplaint
                ? <button className="btn btn-secondary" key={`${action.tipo}-${index}`} onClick={onComplaint}>Registrar mi queja</button>
                : null
          ))}
        </div>
      ) : null}
      <time className="chat-message-time" dateTime={mensaje.fecha}>{formatDateTime(mensaje.fecha)}</time>
    </article>
  );
}
