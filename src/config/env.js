// Interruptores de entorno. Se leen una sola vez aquí; el resto de la app importa estos valores.
const flag = (valor, porDefecto) => (valor === undefined ? porDefecto : String(valor).toLowerCase() === "true");

// false = servicios simulados (Parte A). true = backend de Azure (Parte B).
export const USE_AZURE = flag(import.meta.env.VITE_USE_AZURE, false);
export const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/+$/, "") || "/api";
// Interruptor de apagado del asistente de IA.
export const ASSISTANT_ENABLED = flag(import.meta.env.VITE_ASSISTANT_ENABLED, true);
