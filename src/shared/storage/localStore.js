// Envoltorio de localStorage: prefijo, JSON seguro y manejo de cuota.
// Si localStorage no existe o está bloqueado (modo privado, pruebas), usa memoria.
import { STORAGE_PREFIX } from "../../config/constants.js";

function memoria() {
  const m = new Map();
  return {
    get length() { return m.size; },
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    key: (index) => [...m.keys()][index] ?? null,
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
  };
}

function backendPorDefecto() {
  try {
    const s = globalThis.localStorage;
    if (!s) return memoria();
    s.getItem("__rc_test__");
    return s;
  } catch {
    return memoria();
  }
}

const esErrorDeCuota = (e) =>
  e && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" || e.code === 22 || e.code === 1014);

export function createLocalStore(backend = backendPorDefecto(), prefix = STORAGE_PREFIX) {
  return {
    /** Lee y parsea un valor. Si no existe o el JSON está dañado, devuelve `fallback`. */
    get(key, fallback = null) {
      try {
        const raw = backend.getItem(prefix + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    /** Guarda un valor. Nunca lanza: devuelve { ok: true } o { ok: false, error }. */
    set(key, value) {
      try {
        backend.setItem(prefix + key, JSON.stringify(value));
        return { ok: true };
      } catch (e) {
        return { ok: false, error: esErrorDeCuota(e) ? "cuota" : "desconocido" };
      }
    },
    remove(key) {
      try {
        backend.removeItem(prefix + key);
      } catch {
        /* nada que hacer */
      }
    },
    clearAll() {
      const keys = [];
      for (let index = 0; index < backend.length; index += 1) {
        const key = backend.key(index);
        if (key?.startsWith(prefix)) keys.push(key);
      }
      keys.forEach((key) => backend.removeItem(key));
      return keys.length;
    },
  };
}

export const localStore = createLocalStore();
