import { useId, useState } from "react";
import {
  MIN_COMMENT_ESCALATE,
  MIN_COMMENT_REPLY,
  MIN_COMMENT_RESOLVE,
} from "../../../config/constants.js";
import Button from "../../../shared/ui/Button.jsx";
import Dialog from "../../../shared/ui/Dialog.jsx";

const ACTIONS = {
  responder: { label: "responder", minimum: MIN_COMMENT_REPLY },
  escalar: { label: "escalar", minimum: MIN_COMMENT_ESCALATE },
  resolver: { label: "resolver", minimum: MIN_COMMENT_RESOLVE },
  cerrar: { label: "cerrar", minimum: 0 },
};

/**
 * Solicita comentario y calificación antes de aplicar una acción.
 * @param {Object} props Acción, queja y callbacks.
 * @returns {import("react").JSX.Element|null} Diálogo de confirmación.
 */
export default function ComplaintActionDialog({ accion, queja, onConfirm, onCancel }) {
  const titleId = useId();
  const commentId = useId();
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const active = Boolean(accion && queja && ACTIONS[accion]);
  if (!active) return null;

  const action = ACTIONS[accion];
  const actionName = action.label;
  const trimmedComment = comment.trim();
  const commentInvalid = action.minimum > 0 && trimmedComment.length < action.minimum;

  async function submit(event) {
    event.preventDefault();
    if (commentInvalid) {
      setError(`El comentario es obligatorio (mínimo ${action.minimum} caracteres)`);
      return;
    }
    if (accion === "cerrar" && !rating) {
      setError("La calificación debe ser de 1 a 5");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await onConfirm({
        comentario: trimmedComment || undefined,
        calificacion: rating ? Number(rating) : undefined,
      });
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "No se pudo registrar la acción.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onCancel}
      labelledBy={titleId}
      className="quejas-dialog quejas-action-dialog"
      dirty={Boolean(trimmedComment) || Boolean(rating)}
    >
      <form className="quejas-dialog-content" onSubmit={submit}>
        <header className="quejas-dialog-header">
          <h2 id={titleId}>Confirmar acción</h2>
          <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        </header>
        <p>
          Vas a {actionName} la queja {queja.folio} de {queja.clienteNombre || queja.idCliente}.
        </p>
        <div className="campo">
          <label htmlFor={commentId}>
            Comentario {action.minimum ? "(obligatorio)" : "(opcional)"}
          </label>
          <textarea
            id={commentId}
            autoFocus
            data-autofocus
            rows={5}
            maxLength={1000}
            value={comment}
            aria-invalid={Boolean(error && commentInvalid) || undefined}
            aria-describedby={`${commentId}-counter${error ? ` ${commentId}-error` : ""}`}
            onChange={(event) => setComment(event.target.value)}
          />
          <p id={`${commentId}-counter`} className="quejas-comment-count" aria-live="polite">
            {trimmedComment.length} / {action.minimum} caracteres mínimos
          </p>
        </div>
        {accion === "cerrar" ? (
          <div className="campo">
            <label htmlFor={`${commentId}-rating`}>Calificación del cliente</label>
            <select
              id={`${commentId}-rating`}
              value={rating}
              aria-invalid={Boolean(error && accion === "cerrar" && !rating) || undefined}
              onChange={(event) => setRating(event.target.value)}
            >
              <option value="">Selecciona una calificación</option>
              {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
        ) : null}
        {error ? <p id={`${commentId}-error`} className="quejas-error" role="alert">{error}</p> : null}
        <div className="quejas-dialog-actions">
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando…" : `Confirmar ${actionName}`}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>Cancelar</Button>
        </div>
      </form>
    </Dialog>
  );
}
