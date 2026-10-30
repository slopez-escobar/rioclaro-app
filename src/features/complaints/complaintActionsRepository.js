import { STORAGE_KEYS } from "../../config/constants.js";
import { localStore } from "../../shared/storage/localStore.js";

function readState(store) {
  const state = store.get(STORAGE_KEYS.complaintActions, null);
  if (!state || state.version !== 1 || !state.acciones || typeof state.acciones !== "object"
    || Array.isArray(state.acciones)
    || Object.values(state.acciones).some((actions) => !Array.isArray(actions))) {
    return { version: 1, acciones: {} };
  }
  return state;
}

function saveState(store, state) {
  const result = store.set(STORAGE_KEYS.complaintActions, state);
  if (result.ok) return;
  if (result.error === "cuota") {
    throw new Error("No se pudo guardar: el almacenamiento del navegador está lleno. Usa 'Restablecer demo de quejas'.");
  }
  throw new Error("No se pudieron guardar las acciones de la queja.");
}

/**
 * Crea el repositorio local de acciones reproducibles sobre las quejas base.
 * @param {{store:Object}} options Almacén local compatible.
 * @returns {Object} Operaciones sobre las acciones guardadas.
 */
export function createComplaintActionsRepository({ store = localStore } = {}) {
  return {
    listAll() {
      return structuredClone(readState(store).acciones);
    },
    listFor(idQueja) {
      return structuredClone(readState(store).acciones[idQueja] || []);
    },
    append(idQueja, accion) {
      const state = readState(store);
      state.acciones[idQueja] = [...(state.acciones[idQueja] || []), structuredClone(accion)];
      saveState(store, state);
      return structuredClone(accion);
    },
    reset() {
      store.remove(STORAGE_KEYS.complaintActions);
    },
  };
}

export const complaintActionsRepository = createComplaintActionsRepository();
