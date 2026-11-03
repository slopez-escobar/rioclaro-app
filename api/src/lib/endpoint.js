import { fail } from "./http.js";

export function recordRequest(context, {
  endpoint,
  usuario = "anónimo",
  status,
  startedAt,
  now = Date.now,
  size,
  messages,
}) {
  if (typeof context?.log !== "function") return;
  const currentTime = typeof now === "function" ? now() : now;
  context.log({
    usuario,
    endpoint,
    estado: status,
    milisegundos: Math.max(0, currentTime - startedAt),
    ...(Number.isFinite(size) ? { tamano: size } : {}),
    ...(Number.isFinite(messages) ? { mensajes: messages } : {}),
  });
}

export function rateLimitResponse(result) {
  return {
    ...fail(429, "Demasiadas consultas. Intenta de nuevo más tarde."),
    headers: { "retry-after": String(result.reintentarEnSegundos) },
  };
}

export function readProviderJson(response) {
  return response.json().catch(() => {
    const error = new Error("Respuesta inválida del servicio de Azure");
    error.status = 502;
    error.codigo = "RESPUESTA_INVALIDA";
    throw error;
  });
}
