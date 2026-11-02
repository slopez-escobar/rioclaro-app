import {
  ASSISTANT_OFF,
  REFUSAL_INJECTION,
  REFUSAL_SENSITIVE,
} from "./guidelines.js";

export function normalizeGuardrailText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX");
}

export function getGuardrailResponse(text, assistantEnabled) {
  if (!assistantEnabled) return { texto: ASSISTANT_OFF, estado: "apagado" };

  const query = normalizeGuardrailText(text);
  if (/\b(ignora tus reglas|olvida tus instrucciones|inventa precios|actua como|modo desarrollador)\b/.test(query)) {
    return { texto: REFUSAL_INJECTION, estado: "rechazado" };
  }
  if (/\b(salario|sueldo|nomina|cuanto gana|rfc|contrasena|datos de otros clientes)\b/.test(query)) {
    return { texto: REFUSAL_SENSITIVE, estado: "rechazado" };
  }
  return null;
}

export function isComplaintRequest(text) {
  return /\b(queja|reclamo|molesto|no me llego|mal servicio)\b/.test(
    normalizeGuardrailText(text),
  );
}
