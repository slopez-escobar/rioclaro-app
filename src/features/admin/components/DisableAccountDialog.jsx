import { useState } from "react";
import Button from "../../../shared/ui/Button.jsx";
import Dialog from "../../../shared/ui/Dialog.jsx";

export default function DisableAccountDialog({ account, onClose, onConfirm, error }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (!account) return null;
  const valid = reason.trim().length >= 5;

  async function submit(event) {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    try {
      await onConfirm(account.usuario, reason.trim());
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      labelledBy="disable-account-title"
      className="admin-dialog"
      dirty={reason.length > 0}
    >
      <h2 id="disable-account-title">Desactivar cuenta</h2>
      <p>
        Vas a desactivar la cuenta de {account.nombre} ({account.usuario}).
        No podrá entrar hasta que se reactive.
      </p>
      <form onSubmit={submit}>
        <label className="admin-textarea-field" htmlFor="disable-account-reason">
          Motivo
          <textarea
            id="disable-account-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            minLength={5}
            maxLength={500}
            rows={4}
            aria-describedby="disable-account-counter disable-account-error"
            data-autofocus
          />
        </label>
        <p id="disable-account-counter" className="admin-character-count" aria-live="polite">
          {reason.trim().length}/5 caracteres mínimos
        </p>
        {!valid && reason.length > 0 ? (
          <p id="disable-account-error" role="alert" className="error">
            El motivo es obligatorio (mínimo 5 caracteres)
          </p>
        ) : <span id="disable-account-error" className="sr-only" />}
        {error ? <p role="alert" className="error">{error}</p> : null}
        <div className="admin-dialog-actions">
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button type="submit" disabled={!valid || busy}>Confirmar desactivación</Button>
        </div>
      </form>
    </Dialog>
  );
}
