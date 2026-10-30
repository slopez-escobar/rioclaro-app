import { useState } from "react";
import { can } from "../../auth/permissions.js";

export default function AssistantSwitch({ session, enabled, onChange }) {
  const [error, setError] = useState("");
  if (!can(session?.rol, "usuarios_y_accesos", "apagar_asistente")) return null;
  const change = async (event) => {
    const value = event.target.checked;
    if (!value && !globalThis.confirm("¿Quieres apagar el asistente para todas las personas?")) {
      event.target.checked = true;
      return;
    }
    setError("");
    try {
      await onChange(value);
    } catch (issue) {
      event.target.checked = enabled;
      setError(issue.message || "No se pudo cambiar el estado del asistente.");
    }
  };
  return (
    <div className="chat-switch-wrap">
      <label className="chat-switch-label">
        <input type="checkbox" checked={enabled} onChange={change} aria-label="Asistente encendido/apagado" />
        <span>Asistente {enabled ? "encendido" : "apagado"}</span>
      </label>
      {error ? <p role="alert" className="error">{error}</p> : null}
    </div>
  );
}
