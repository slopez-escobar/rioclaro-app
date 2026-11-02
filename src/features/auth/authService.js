// Operaciones compartidas de sesión y autenticación remota.
import { USE_AZURE } from "../../config/env.js";
import { localStore } from "../../shared/storage/localStore.js";
import { STORAGE_KEYS } from "../../config/constants.js";
import { apiClient, ApiError } from "../../shared/api/apiClient.js";
import {
  accountOverridesRepository,
  createAccountOverridesRepository,
} from "../admin/accountOverridesRepository.js";

function overridesFor(store, overrides) {
  return overrides
    || (store === localStore
      ? accountOverridesRepository
      : createAccountOverridesRepository({ store }));
}

export async function loginRemote(usuario, password, { client = apiClient, store = localStore } = {}) {
  try {
    const result = await client.request("/login", {
      method: "POST",
      body: { usuario: String(usuario || "").trim(), password },
    });
    if (!result?.token || !result?.sesion) {
      return { ok: false, error: "El servidor devolvió una respuesta inesperada." };
    }
    store.set(STORAGE_KEYS.session, result.sesion);
    store.set(STORAGE_KEYS.authToken, result.token);
    return { ok: true, session: result.sesion };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.mensaje };
    return { ok: false, error: "No hay conexión con el servidor. Intenta de nuevo." };
  }
}

export function getSession(
  store = localStore,
  overrides,
  azure = USE_AZURE,
) {
  const s = store.get(STORAGE_KEYS.session, null);
  if (!s) return null;
  if (azure && !store.get(STORAGE_KEYS.authToken, null)) {
    logout(store);
    return null;
  }
  if (s.expiraEn && s.expiraEn < Date.now()) { logout(store); return null; }
  if (!azure && overridesFor(store, overrides).isDisabled(s.usuario)) {
    logout(store);
    return null;
  }
  return s;
}

export function logout(store = localStore) {
  store.remove(STORAGE_KEYS.session);
  store.remove(STORAGE_KEYS.authToken);
}
