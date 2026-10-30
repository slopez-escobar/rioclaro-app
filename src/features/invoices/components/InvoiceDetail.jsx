import { useEffect, useRef } from "react";
import Button from "../../../shared/ui/Button.jsx";
import { formatDate, formatDateTime, formatMXN } from "../../../shared/utils/format.js";
import { canDecide, pendingApprovals, requiredApprovals } from "../domain/invoiceDecisions.js";
import ConfidenceValue from "./ConfidenceValue.jsx";
import StatusTag from "./StatusTag.jsx";
import { invoiceFieldValue } from "./presentation.js";
import "./invoice-components.css";

const FIELD_LABELS = [
  ["proveedor", "Proveedor"],
  ["rfc", "RFC"],
  ["folio", "Folio"],
  ["fecha", "Fecha"],
  ["total", "Total"],
];
const ROLE_LABELS = { finanzas: "Finanzas", direccion: "Dirección" };
const ACTION_LABELS = {
  aprobar: "Aprobar",
  rechazar: "Rechazar",
  liberar: "Liberar duplicada",
};

/**
 * Muestra detalles, historial y decisiones disponibles de una factura.
 * @param {Object} props Factura, sesión y callbacks de acciones.
 * @returns {import("react").JSX.Element|null} Diálogo de detalle.
 */
export default function InvoiceDetail({
  factura,
  session,
  onClose,
  onDecision,
  onOpenOther,
}) {
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!factura || !dialog) return undefined;
    returnFocusRef.current = document.activeElement;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector("button")?.focus();
    return () => {
      if (dialog.open) dialog.close();
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
    };
  }, [factura]);

  if (!factura) return null;

  const pending = pendingApprovals(factura);
  const required = requiredApprovals(invoiceFieldValue(factura.total));
  const approvals = Array.isArray(factura.aprobaciones) ? factura.aprobaciones : [];
  const history = Array.isArray(factura.historial) ? factura.historial : [];
  const duplicateId = factura.duplicadoDe?.id;
  const confidenceFields = Object.fromEntries(FIELD_LABELS.map(([field]) => {
    const value = factura[field];
    return [field, value !== null && typeof value === "object" && Object.hasOwn(value, "valor")
      ? value
      : { valor: value, confianza: factura.confianza?.[field] }];
  }));

  function closeDialog() {
    if (dialogRef.current?.open) dialogRef.current.close();
    onClose?.();
    if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
  }

  return (
    <dialog
      ref={dialogRef}
      className="factura-dialog"
      aria-labelledby="invoice-detail-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeDialog();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        closeDialog();
      }}
    >
      <div className="factura-dialog-content">
        <header className="factura-dialog-header">
          <div>
            <h2 id="invoice-detail-title">Detalle de factura</h2>
            <p>{factura.archivo}</p>
          </div>
          <Button variant="secondary" onClick={closeDialog}>
            Cerrar
          </Button>
        </header>

        <p><StatusTag estado={factura.estado} /></p>
        <dl className="factura-fields">
          {FIELD_LABELS.map(([field, label]) => (
            <div key={field}>
              <dt>{label}</dt>
              <dd>
                <ConfidenceValue
                  campo={confidenceFields[field]}
                  formato={field === "total" ? formatMXN : field === "fecha" ? formatDate : undefined}
                />
              </dd>
            </div>
          ))}
        </dl>

        <section className="factura-dialog-section">
          <h3>Nombre estándar sugerido</h3>
          <p>{factura.nombreEstandar || "—"}</p>
        </section>

        {factura.estado === "Duplicada" ? (
          <section className="factura-dialog-section">
            <h3>Referencia de duplicado</h3>
            {duplicateId ? (
              <Button
                variant="secondary"
                onClick={() => onOpenOther?.(duplicateId)}
              >
                Duplicada de: {factura.duplicadoDe.archivo || duplicateId}
              </Button>
            ) : (
              <p>Duplicada de: {factura.duplicadoDe?.archivo || "Factura original no disponible"}</p>
            )}
          </section>
        ) : null}

        {factura.motivos?.length > 0 ? (
          <section className="factura-dialog-section">
            <h3>Motivos</h3>
            <ul className="factura-list">
              {factura.motivos.map((reason, index) => <li key={`${index}-${reason}`}>{reason}</li>)}
            </ul>
          </section>
        ) : null}

        <section className="factura-dialog-section">
          <h3>Aprobaciones</h3>
          <p className="factura-approval">
            {required.map((role) => {
              const approval = approvals.find((item) => item.rol === role);
              const coveredByDirection = role === "finanzas"
                && approvals.some((item) => item.rol === "direccion");
              const completed = Boolean(approval || coveredByDirection);
              return (
                <span key={role}>
                  {ROLE_LABELS[role]} {completed ? "✓" : "pendiente"}
                </span>
              );
            })}
          </p>
          {approvals.length > 0 ? (
            <ul className="factura-list">
              {approvals.map((approval, index) => (
                <li key={`${approval.usuario}-${approval.fecha}-${index}`}>
                  {approval.nombre} · {ROLE_LABELS[approval.rol] || approval.rol} · {formatDateTime(approval.fecha)}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="factura-dialog-section">
          <h3>Historial</h3>
          {history.length ? (
            <ol className="factura-list">
              {history.map((event, index) => (
                <li className="factura-history-item" key={`${event.fecha}-${index}`}>
                  <strong>{formatDateTime(event.fecha)} · {event.nombre || event.usuario}</strong>
                  <div>{event.accion}</div>
                  {event.comentario ? <p>{event.comentario}</p> : null}
                </li>
              ))}
            </ol>
          ) : <p>Aún no hay movimientos.</p>}
        </section>

        <div className="factura-dialog-actions" aria-label="Decisiones disponibles">
          {Object.entries(ACTION_LABELS).map(([action, label]) => {
            const decision = canDecide(session, factura, action);
            return (
              <div key={action}>
                <Button
                  variant={action === "rechazar" ? "danger" : "primary"}
                  disabled={!decision.permitido}
                  onClick={() => onDecision?.(action)}
                >
                  {label}
                </Button>
                {!decision.permitido ? (
                  <p className="factura-error" role="status">{decision.motivo}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </dialog>
  );
}
