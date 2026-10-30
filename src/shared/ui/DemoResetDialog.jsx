import Dialog from "./Dialog.jsx";
import Button from "./Button.jsx";

export default function DemoResetDialog({ open, onClose, onConfirm }) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy="demo-reset-title">
      <div className="demo-reset-dialog">
        <h2 id="demo-reset-title">¿Restablecer toda la demo?</h2>
        <p>
          Se borrarán las facturas, quejas, conversaciones y cambios que hayas hecho en este navegador.
          Los datos de ejemplo no se pierden.
        </p>
        <div className="demo-reset-actions">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="danger" onClick={onConfirm}>Restablecer demo</Button>
        </div>
      </div>
    </Dialog>
  );
}
