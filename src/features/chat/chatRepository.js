import { STORAGE_KEYS } from "../../config/constants.js";
import { localStore } from "../../shared/storage/localStore.js";

const MAX_MESSAGES = 50;

function storageKey(usuario) {
  return `${STORAGE_KEYS.chat}:${String(usuario || "").trim().toLowerCase()}`;
}

function makeMessageId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `mensaje-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Crea el historial local aislado por usuario.
 * @param {{store?:Object}} options Adaptador de almacenamiento.
 * @returns {Object} Operaciones del historial.
 */
export function createChatRepository({ store = localStore } = {}) {
  return {
    list(usuario) {
      const messages = store.get(storageKey(usuario), []);
      return Array.isArray(messages) ? structuredClone(messages) : [];
    },
    append(usuario, mensaje) {
      if (!String(usuario || "").trim()) throw new Error("Se requiere el usuario del historial.");
      const messages = this.list(usuario);
      const stored = {
        id: mensaje.id || makeMessageId(),
        role: mensaje.role,
        texto: String(mensaje.texto ?? ""),
        fuentes: structuredClone(mensaje.fuentes || []),
        acciones: structuredClone(mensaje.acciones || []),
        estado: mensaje.estado || "respondido",
        fecha: mensaje.fecha || new Date().toISOString(),
      };
      messages.push(stored);
      const result = store.set(storageKey(usuario), messages.slice(-MAX_MESSAGES));
      if (result.ok) return structuredClone(stored);
      if (result.error === "cuota") {
        throw new Error("No se pudo guardar el historial porque el almacenamiento está lleno.");
      }
      throw new Error("No se pudo guardar el historial en este dispositivo.");
    },
    clear(usuario) {
      if (!String(usuario || "").trim()) throw new Error("Se requiere el usuario del historial.");
      store.remove(storageKey(usuario));
    },
  };
}
