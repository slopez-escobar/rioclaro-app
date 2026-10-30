import { useEffect, useId, useRef, useState } from "react";
import {
  MIN_COMMENT_REJECT,
  MIN_COMMENT_RELEASE,
} from "../../../config/constants.js";
import Button from "../../../shared/ui/Button.jsx";
import { formatMXN } from "../../../shared/utils/format.js";
import { pendingApprovals } from "../domain/invoiceDecisions.js";
import { invoiceFieldValue } from "./presentation.js";
import "./invoice-components.css";

const ACTION_VERBS = {
  aprobar: "aprobar",
  rechazar: "rechazar",
  liberar: "liberar",
};

function minimumCommentLength(action, invoice) {
  if (action === "liberar") return MIN_COMMENT_RELEASE;
  if (action === "rechazar" || (action === "aprobar" && invoice?.estado === "Revisar")) {
    return MIN_COMMENT_REJECT;
  }
  return 0;
}

/**
 * Confirma una decisión y valida el comentario requerido.
 * @param {Object} props Acción, factura y callbacks de confirmación.
 * @returns {import("react").JSX.Element|null} Diálogo de confirmación.
 */
export default function DecisionDialog({ accion, factura, onConfirm, onCancel }) {
  const dialogRef = useRef(null);
  const textareaRef = useRef(null);
  const returnFocusRef = useRef(null);
  const commentId = useId();
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const active = Boolean(accion && factura);
  const minimum = active ? minimumCommentLength(accion, factura) : 0;
  const trimmedLength = comment.trim().length;
  const invalid = trimmedLength < minimum;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!active || !dialog) return undefined;
    returnFocusRef.current = document.activeElement;
    setComment("");
    setSubmitted(false);
    if (!dialog.open) dialog.showModal();
    textareaRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
    };
  }, [active, accion, factura]);

  if (!active) return null;

  const folio = invoiceFieldValue(factura.folio) || "sin folio";
  const provider = invoiceFieldValue(factura.proveedor) || "proveedor sin identificar";
  const total = formatMXN(invoiceFieldValue(factura.total));
  const requiresDirection = pendingApprovals(factura).includes("direccion")
    || factura.requiereDireccion;
  const error = submitted && invalid
    ? `El comentario es obligatorio (mínimo ${minimum} caracteres)`
    : "";

  function cancel() {
    if (dialogRef.current?.open) dialogRef.current.close();
    onCancel?.();
    if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
  }

  function confirm(event) {
    event.preventDefault();
    setSubmitted(true);
    if (invalid) {
      textareaRef.current?.focus();
      return;
    }
    onConfirm?.(comment.trim());
  }

  const dialogTitle = `Confirmar: ${ACTION_VERBS[accion] || accion}`;
  return (
    <dialog
      ref={dialogRef}
      className="factura-dialog"
      aria-labelledby="invoice-decision-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          cancel();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
    >
      <form className="factura-dialog-content" onSubmit={confirm}>
        <header className="factura-dialog-header">
          <h2 id="invoice-decision-title">{dialogTitle}</h2>
          <Button variant="secondary" type="button" onClick={cancel}>Cancelar</Button>
        </header>
        <p>
          Vas a {ACTION_VERBS[accion] || accion} la factura {folio} de {provider} por {total}.
        </p>
        {requiresDirection ? (
          <p className="factura-warning">Requiere además la aprobación de Dirección.</p>
        ) : null}
        <div className="campo">
          <label htmlFor={commentId}>Comentario {minimum ? "(obligatorio)" : "(opcional)"}</label>
          <textarea
            id={commentId}
            ref={textareaRef}
            value={comment}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={`${commentId}-counter${error ? ` ${commentId}-error` : ""}`}
            onChange={(event) => setComment(event.target.value)}
          />
          <div className="factura-comment-meta">
            <span id={`${commentId}-counter`}>{trimmedLength} / {minimum} caracteres mínimos</span>
          </div>
          {error ? <p id={`${commentId}-error`} className="factura-error" role="alert">{error}</p> : null}
        </div>
        <div className="factura-decision-actions">
          <Button type="submit" variant={accion === "rechazar" ? "danger" : "primary"}>
            Confirmar {ACTION_VERBS[accion] || accion}
          </Button>
          <Button type="button" variant="secondary" onClick={cancel}>Cancelar</Button>
        </div>
      </form>
    </dialog>
  );
}
