import { STORAGE_KEYS } from "../../config/constants.js";
import { localStore } from "../../shared/storage/localStore.js";

function readState(store) {
  const state = store.get(STORAGE_KEYS.complaints, null);
  if (!state || state.version !== 1 || !Array.isArray(state.items)) {
    return { version: 1, items: [] };
  }
  return state;
}

function saveState(store, state) {
  const result = store.set(STORAGE_KEYS.complaints, state);
  if (result.ok) return;
  if (result.error === "cuota") {
    throw new Error("No se pudo guardar la queja porque el almacenamiento está lleno.");
  }
  throw new Error("No se pudo guardar la queja en este dispositivo.");
}

/**
 * Crea el repositorio local de quejas generadas durante el uso del asistente.
 * @param {{store?:Object,baseCount:number}} options Almacén y total histórico.
 * @returns {Object} Operaciones sobre las nuevas quejas.
 */
export function createComplaintRepository({ store = localStore, baseCount }) {
  if (!Number.isInteger(baseCount) || baseCount < 0) {
    throw new Error("El total base de quejas debe ser un entero no negativo.");
  }
  return {
    listNuevas() {
      return structuredClone(readState(store).items);
    },
    add(registro) {
      const state = readState(store);
      state.items.push(structuredClone(registro));
      saveState(store, state);
      return structuredClone(registro);
    },
    nextNumber() {
      return baseCount + readState(store).items.length + 1;
    },
    clear() {
      store.remove(STORAGE_KEYS.complaints);
    },
  };
}

let complaintRepositoryPromise;

/**
 * Obtiene el repositorio predeterminado con el conteo real de quejas históricas.
 * @returns {Promise<Object>} Repositorio listo para usarse.
 */
export function getComplaintRepository() {
  if (!complaintRepositoryPromise) {
    complaintRepositoryPromise = import("../../data/repositories/quejasRepository.js")
      .then(({ getBaseCount }) => getBaseCount())
      .then((baseCount) => createComplaintRepository({ store: localStore, baseCount }));
  }
  return complaintRepositoryPromise;
}

export const complaintRepository = {
  listNuevas: async () => (await getComplaintRepository()).listNuevas(),
  add: async (record) => (await getComplaintRepository()).add(record),
  nextNumber: async () => (await getComplaintRepository()).nextNumber(),
  clear: async () => (await getComplaintRepository()).clear(),
};
