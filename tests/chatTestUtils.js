import { createLocalStore } from "../src/shared/storage/localStore.js";
import { getSession } from "../src/features/auth/authService.js";
import { login } from "../src/features/auth/authService.local.js";
import { usuarios } from "../src/features/auth/data/usuarios.json";

export function memoryStore(initial = {}) {
  const values = new Map(Object.entries(initial));
  return createLocalStore({
    get length() { return values.size; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    key(index) { return [...values.keys()][index] ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  });
}

export function sessionFor(username) {
  const account = usuarios.find((item) => item.usuario === username);
  if (!account) throw new Error(`No existe la cuenta demo ${username}`);
  const store = memoryStore();
  const result = login(username, account.password, store);
  if (!result.ok) throw new Error(result.error);
  return getSession(store);
}

export function cuotaStore() {
  return {
    get() { return null; },
    set() { return { ok: false, error: "cuota" }; },
    remove() {},
  };
}
