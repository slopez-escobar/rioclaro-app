import { useId } from "react";
import Button from "../../../shared/ui/Button.jsx";
import Dialog from "../../../shared/ui/Dialog.jsx";
import Tag from "../../../shared/ui/Tag.jsx";
import { formatDateTime, formatMXN } from "../../../shared/utils/format.js";

const ACTIONS = [
  ["responder", "Responder"],
  ["escalar", "Escalar"],
  ["resolver", "Resolver"],
  ["cerrar", "Cerrar"],
];
const ACTION_CLASSES = { cerrar: "danger" };
const RESPONSE_LABELS = {
  acuse: "Acuse",
  seguimiento: "Seguimiento",
  escalamiento: "Escalamiento",
  resolucion: "Resolución",
  cierre: "Cierre",
};
const SENTIMENT_LABELS = {
  positivo: "Positivo",
  neutral: "Neutral",
  negativo: "Negativo",
  sin_analizar: "Sin analizar",
};
const ANALYSIS_ORIGIN_LABELS = {
  "azure-language": "Analizado con Azure AI Language",
  simulado: "Análisis simulado (modo local)",
  estimado: "Estimación local (no analizada con Azure AI Language)",
};
const THEME_LABELS = {
  sin_existencia: "Falta de existencia",
  error_de_captura: "Error de captura",
  entrega_fallida: "Entrega fallida",
  cobro_duplicado: "Cobro duplicado",
  cancelacion_solicitada: "Cancelación solicitada",
  sin_clasificar: "Sin clasificar",
};

/**
 * Muestra los datos, análisis, historial y opciones de atención de una queja.
 * @param {Object} props Queja seleccionada y callbacks.
 * @returns {import("react").JSX.Element|null} Diálogo de detalle.
 */
export default function ComplaintDetail({ queja, onClose, onAction, onOpenOther }) {
  const titleId = useId();
  if (!queja) return null;

  const fields = [
    ["Folio", queja.folio],
    ["Cliente", queja.clienteNombre || queja.idCliente],
    ["Pedido", queja.folioPedido || queja.idPedido || "Sin pedido relacionado"],
    ["Sucursal", queja.sucursalNombre || queja.idSucursal],
    ["Sucursal que surtió", queja.sucursalSurtidoNombre || "No especificada"],
    ["Monto", formatMXN(queja.montoPedidoMXN)],
    ["Canal", queja.canal],
    ["Prioridad", queja.prioridad],
    ["Tema", THEME_LABELS[queja.tema] || queja.tema],
    ["Motivo de cancelación", queja.motivoCancelacionPedido || "No especificado"],
  ];
  const sentiment = queja.sentimiento || {};
  const actions = queja.accionesPermitidas || queja.acciones || {};

  return (
    <Dialog
      open
      onClose={onClose}
      labelledBy={titleId}
      className="quejas-dialog quejas-detail-dialog"
    >
      <div className="quejas-dialog-content">
        <header className="quejas-dialog-header">
          <div>
            <h2 id={titleId}>Detalle de queja</h2>
            <p>{queja.folio}</p>
          </div>
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
        </header>

        <dl className="quejas-detail-fields">
          {fields.map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
          ))}
        </dl>

        <section className="quejas-detail-section">
          <h3>Descripción</h3>
          <p>{queja.descripcion}</p>
        </section>

        <section className="quejas-detail-section">
          <h3>Análisis automático</h3>
          <p>
            Sentimiento: <Tag variant={sentiment.sentimiento === "negativo" ? "rechazada" : sentiment.sentimiento === "positivo" ? "ok" : "info"}>
              {SENTIMENT_LABELS[sentiment.sentimiento] || "Sin análisis"}
            </Tag>
            {" "}· Confianza: {Number.isFinite(sentiment.confianza)
              ? `${Math.round(sentiment.confianza * 100)}%`
              : "—"}
          </p>
          {sentiment.sentimiento === "sin_analizar" ? null : sentiment.frasesClave?.length ? (
            <ul className="quejas-phrase-list">
              {sentiment.frasesClave.map((phrase) => <li key={phrase}>{phrase}</li>)}
            </ul>
          ) : <p>No se detectaron frases clave.</p>}
          <p className="quejas-note">{sentiment.sentimiento === "sin_analizar"
            ? "No se pudo analizar"
            : ANALYSIS_ORIGIN_LABELS[sentiment.origen] || "No se pudo analizar"}</p>
        </section>

        {queja.casoRepetido ? (
          <section className="quejas-detail-section">
            <h3>Casos relacionados</h3>
            <ul className="quejas-related-list">
              {queja.quejasRelacionadas.map((id) => (
                <li key={id}>
                  <Button variant="secondary" onClick={() => onOpenOther(id)}>{id}</Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="quejas-detail-section">
          <h3>Historial de respuestas</h3>
          {queja.respuestas?.length ? (
            <ol className="quejas-timeline">
              {queja.respuestas.map((response, index) => (
                <li key={`${response.fecha}-${response.tipo}-${index}`}>
                  <strong>{formatDateTime(response.fecha)} · {response.autor?.nombre || "Autor desconocido"}</strong>
                  {response.autor?.puesto ? <span>{response.autor.puesto}</span> : null}
                  <span>{RESPONSE_LABELS[response.tipo] || response.tipo}</span>
                  <p>{response.comentario}</p>
                </li>
              ))}
            </ol>
          ) : <p>Aún no hay respuestas.</p>}
        </section>

        <section className="quejas-detail-actions" aria-label="Acciones de atención">
          {ACTIONS.map(([action, label]) => {
            const decision = actions[action] || { permitido: false, motivo: "No disponible" };
            return (
              <div className="quejas-action-option" key={action}>
                <Button
                  variant={ACTION_CLASSES[action] || "primary"}
                  disabled={!decision.permitido}
                  aria-describedby={!decision.permitido ? `motivo-${action}` : undefined}
                  onClick={() => onAction(action)}
                >
                  {label}
                </Button>
                {!decision.permitido ? (
                  <p id={`motivo-${action}`} className="quejas-action-reason" role="status">{decision.motivo}</p>
                ) : null}
              </div>
            );
          })}
        </section>
      </div>
    </Dialog>
  );
}
