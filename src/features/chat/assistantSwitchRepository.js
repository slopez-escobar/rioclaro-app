import { can } from "../auth/permissions.js";
import { localStore } from "../../shared/storage/localStore.js";
import { ASSISTANT_ENABLED } from "../../config/env.js";

const ASSISTANT_ENABLED_KEY = "assistantEnabled";

/**
 * Crea el interruptor de disponibilidad del asistente.
 * @param {{store?:Object,envEnabled?:boolean}} options Estado y configuración.
 * @returns {Object} Lectura y cambio del interruptor.
 */
export function createAssistantSwitch({
  store = localStore,
  envEnabled = ASSISTANT_ENABLED,
} = {}) {
  const isEnabled = () =>
    Boolean(envEnabled) && store.get(ASSISTANT_ENABLED_KEY, true) !== false;
  return {
    isEnabled,
    setEnabled(valor, session) {
      if (!can(session?.rol, "usuarios_y_accesos", "apagar_asistente")) {
        throw new Error("No tienes permiso para apagar el asistente");
      }
      if (typeof valor !== "boolean") {
        throw new Error("El estado del asistente debe ser verdadero o falso.");
      }
      const result = store.set(ASSISTANT_ENABLED_KEY, valor);
      if (!result.ok) {
        throw new Error(result.error === "cuota"
          ? "No se pudo guardar el interruptor porque el almacenamiento está lleno."
          : "No se pudo guardar el interruptor en este dispositivo.");
      }
      return isEnabled();
    },
  };
}

export const assistantSwitch = createAssistantSwitch();
