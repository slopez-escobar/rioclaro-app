import { STORAGE_KEYS } from "../../config/constants.js";
import { localStore } from "../../shared/storage/localStore.js";

function emptyState() {
  return { version: 1, cuentas: {} };
}

function readState(store) {
  const state = store.get(STORAGE_KEYS.disabledAccounts, null);
  if (
    !state
    || state.version !== 1
    || !state.cuentas
    || typeof state.cuentas !== "object"
    || Array.isArray(state.cuentas)
  ) {
    return emptyState();
  }
  return state;
}

function saveState(store, state) {
  const result = store.set(STORAGE_KEYS.disabledAccounts, state);
  if (!result.ok) {
    throw new Error(result.error === "cuota"
      ? "No se pudo guardar el estado de cuentas porque el almacenamiento está lleno."
      : "No se pudo guardar el estado de cuentas en este dispositivo.");
  }
}

/**
 * Crea el repositorio local de cambios de estado de cuentas.
 * @param {{store:Object}} options Persistencia aislada.
 */
export function createAccountOverridesRepository({ store = localStore } = {}) {
  return {
    isDisabled(usuario) {
      return Object.hasOwn(readState(store).cuentas, usuario);
    },
    list() {
      return Object.entries(readState(store).cuentas).map(([usuario, item]) => ({
        usuario,
        desde: item.desde,
        por: item.por,
        motivo: item.motivo,
      }));
    },
    disable(usuario, datos) {
      const state = readState(store);
      if (Object.hasOwn(state.cuentas, usuario)) {
        throw new Error("La cuenta ya está desactivada");
      }
      const entry = {
        desde: String(datos?.desde ?? ""),
        por: String(datos?.por ?? ""),
        motivo: String(datos?.motivo ?? "").trim(),
      };
      if (!entry.desde || !entry.por || entry.motivo.length < 5) {
        throw new Error("El estado de desactivación de la cuenta no es válido.");
      }
      state.cuentas[usuario] = entry;
      saveState(store, state);
      return { usuario, ...entry };
    },
    enable(usuario) {
      const state = readState(store);
      if (!Object.hasOwn(state.cuentas, usuario)) {
        throw new Error("La cuenta no está desactivada");
      }
      delete state.cuentas[usuario];
      saveState(store, state);
    },
    reset() {
      saveState(store, emptyState());
    },
  };
}

export const accountOverridesRepository = createAccountOverridesRepository();
