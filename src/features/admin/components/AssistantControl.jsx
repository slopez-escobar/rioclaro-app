import Button from "../../../shared/ui/Button.jsx";

export default function AssistantControl({ enabled, onToggle, busy = false }) {
  return (
    <section className="admin-assistant-control" aria-labelledby="admin-assistant-title">
      <div>
        <h2 id="admin-assistant-title">Interruptor del asistente de IA</h2>
        <p>Estado actual: <strong>{enabled ? "Encendido" : "Apagado"}</strong></p>
        <p>Al apagar, el asistente deja de responder a todos los usuarios de este navegador; el resto de la aplicación sigue funcionando.</p>
      </div>
      <Button
        variant={enabled ? "secondary" : "primary"}
        disabled={busy}
        onClick={() => onToggle(!enabled)}
      >
        {enabled ? "Apagar asistente" : "Encender asistente"}
      </Button>
    </section>
  );
}
