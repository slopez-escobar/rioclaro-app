import { STORAGE_KEYS } from "../../config/constants.js";
import { localStore } from "../../shared/storage/localStore.js";

const MAX_ENTRIES = 200;

function readEntries(store) {
  const value = store.get(STORAGE_KEYS.adminAudit, []);
  return Array.isArray(value) ? value.filter((entry) =>
    entry && typeof entry === "object" && !Array.isArray(entry),
  ) : [];
}

function saveEntries(store, entries) {
  const result = store.set(STORAGE_KEYS.adminAudit, entries);
  if (!result.ok) {
    throw new Error(result.error === "cuota"
      ? "No se pudo guardar la auditoría porque el almacenamiento está lleno."
      : "No se pudo guardar la auditoría en este dispositivo.");
  }
}

/**
 * Crea el registro local de auditoría de las acciones administrativas.
 * @param {{store:Object}} options Persistencia aislada.
 */
export function createAdminAuditRepository({ store = localStore } = {}) {
  return {
    list(limit = 50) {
      const safeLimit = Math.max(0, Math.floor(Number(limit) || 0));
      return safeLimit === 0
        ? []
        : structuredClone(readEntries(store).slice(-safeLimit).reverse());
    },
    append(entry) {
      const required = ["fecha", "usuario", "nombre", "accion", "objetivo", "comentario"];
      if (!entry || required.some((key) => typeof entry[key] !== "string")) {
        throw new Error("La entrada de auditoría está incompleta.");
      }
      const entries = [...readEntries(store), structuredClone(entry)].slice(-MAX_ENTRIES);
      saveEntries(store, entries);
      return structuredClone(entry);
    },
    reset() {
      saveEntries(store, []);
    },
  };
}

export const adminAuditRepository = createAdminAuditRepository();
