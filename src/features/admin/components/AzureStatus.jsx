import Button from "../../../shared/ui/Button.jsx";

const SERVICES = [
  ["documentIntelligence", "Document Intelligence"],
  ["chat", "Chat"],
  ["language", "Language"],
  ["speech", "Speech"],
];

export default function AzureStatus({ enabled, health, loading, onRefresh }) {
  return (
    <section className="admin-azure-status" aria-labelledby="admin-azure-title">
      <header>
        <h2 id="admin-azure-title">Servicios de Azure</h2>
        {enabled ? (
          <Button variant="secondary" disabled={loading} onClick={onRefresh}>
            {loading ? "Actualizando…" : "Actualizar"}
          </Button>
        ) : null}
      </header>
      {!enabled ? <p>Modo local: los servicios de Azure están simulados</p> : (
        <>
          <ul>
            {SERVICES.map(([key, label]) => (
              <li key={key}>
                <span>{label}</span>
                <strong>
                  {!health?.disponible
                    ? "No disponible"
                    : health.servicios[key] ? "✓ Configurado" : "✗ No configurado"}
                </strong>
              </li>
            ))}
          </ul>
          <p>Asistente del servidor: {!health?.disponible
            ? "No disponible"
            : health.asistenteEncendido ? "Encendido" : "Apagado"}</p>
        </>
      )}
    </section>
  );
}