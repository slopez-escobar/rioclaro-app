import { describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "../src/config/constants.js";
import { getSession, loginRemote, logout } from "../src/features/auth/authService.js";
import { ApiError, createApiClient } from "../src/shared/api/apiClient.js";
import { createLocalStore } from "../src/shared/storage/localStore.js";

function memoryStore() {
  const values = new Map();
  return createLocalStore({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  });
}

const session = {
  usuario: "laura",
  nombre: "Laura",
  rol: "finanzas",
  expiraEn: Date.now() + 60_000,
};

describe("auth Azure", () => {
  it("guarda token y sesión remota sin contraseña", async () => {
    const store = memoryStore();
    const client = { request: async () => ({ token: "signed-token", sesion: session }) };
    const result = await loginRemote("laura", "demo123", { client, store });

    expect(result).toEqual({ ok: true, session });
    expect(store.get(STORAGE_KEYS.session)).toEqual(session);
    expect(store.get(STORAGE_KEYS.authToken)).toBe("signed-token");
    expect(JSON.stringify(result)).not.toMatch(/password|demo123/i);
  });

  it("conserva los mensajes exactos para credenciales y límite", async () => {
    const store = memoryStore();
    const rejected = await loginRemote("laura", "bad", {
      store,
      client: { request: async () => { throw new ApiError({ status: 401, mensaje: "Usuario o contraseña incorrectos.", codigo: "no_autorizado" }); } },
    });
    const limited = await loginRemote("laura", "demo123", {
      store,
      client: { request: async () => { throw new ApiError({ status: 429, mensaje: "Demasiados intentos. Espera unos minutos.", codigo: "limite" }); } },
    });
    expect(rejected).toEqual({ ok: false, error: "Usuario o contraseña incorrectos." });
    expect(limited).toEqual({ ok: false, error: "Demasiados intentos. Espera unos minutos." });
  });

  it("convierte fallas de red y exige token al recuperar sesión Azure", async () => {
    const store = memoryStore();
    store.set(STORAGE_KEYS.session, session);
    const result = await loginRemote("laura", "demo123", {
      store,
      client: createApiClient({ fetch: async () => { throw new Error("offline"); } }),
    });
    expect(result).toEqual({ ok: false, error: "No hay conexión con el servidor. Intenta de nuevo." });
    expect(getSession(store, undefined, true)).toBeNull();
    expect(store.get(STORAGE_KEYS.session)).toBeNull();
  });

  it("no consulta las desactivaciones locales para una sesión Azure y limpia un token vencido", () => {
    const store = memoryStore();
    store.set(STORAGE_KEYS.session, session);
    store.set(STORAGE_KEYS.authToken, "signed-token");
    store.set(STORAGE_KEYS.disabledAccounts, { version: 1, cuentas: { laura: {} } });
    expect(getSession(store, undefined, true)).toEqual(session);

    store.set(STORAGE_KEYS.session, { ...session, expiraEn: Date.now() - 1 });
    expect(getSession(store, undefined, true)).toBeNull();
    expect(store.get(STORAGE_KEYS.authToken)).toBeNull();
  });

  it("logout elimina tanto la sesión como el token", () => {
    const store = memoryStore();
    store.set(STORAGE_KEYS.session, session);
    store.set(STORAGE_KEYS.authToken, "signed-token");
    logout(store);
    expect(store.get(STORAGE_KEYS.session)).toBeNull();
    expect(store.get(STORAGE_KEYS.authToken)).toBeNull();
  });
});
