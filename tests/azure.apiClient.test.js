import { describe, expect, it, vi } from "vitest";
import { ApiError, createApiClient } from "../src/shared/api/apiClient.js";

function response(status, payload) {
  return { status, ok: status >= 200 && status < 300, json: async () => payload };
}

describe("cliente HTTP Azure", () => {
  it("envía JSON y el token Bearer, y devuelve el JSON exitoso", async () => {
    const fetch = vi.fn(async (url, options) => {
      expect(url).toBe("/api/login");
      expect(options.headers).toMatchObject({
        "Content-Type": "application/json",
        Authorization: "Bearer token-123",
      });
      expect(JSON.parse(options.body)).toEqual({ usuario: "laura" });
      return response(200, { ok: true });
    });
    const client = createApiClient({ fetch, getToken: () => "token-123" });

    await expect(client.request("/login", { method: "POST", body: { usuario: "laura" } }))
      .resolves.toEqual({ ok: true });
  });

  it("no envía Authorization si no hay token", async () => {
    const fetch = vi.fn(async (_url, options) => {
      expect(options.headers.Authorization).toBeUndefined();
      return response(200, { ok: true });
    });
    await createApiClient({ fetch }).request("/health");
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("notifica una sola vez por respuesta 401", async () => {
    const onUnauthorized = vi.fn();
    const client = createApiClient({
      fetch: async () => response(401, { error: "Usuario o contraseña incorrectos." }),
      onUnauthorized,
    });
    await expect(client.request("/login", { method: "POST", body: {} }))
      .rejects.toMatchObject({ status: 401, mensaje: "Usuario o contraseña incorrectos." });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it.each([
    [401, "Tu sesión venció. Vuelve a entrar."],
    [403, "Tu rol no tiene acceso a este servicio."],
    [413, "El archivo supera el tamaño permitido."],
    [429, "El servicio está ocupado. Intenta de nuevo en unos segundos."],
    [503, "El servicio no respondió. Intenta de nuevo."],
  ])("mapea HTTP %i a un mensaje en español", async (status, mensaje) => {
    const client = createApiClient({ fetch: async () => response(status, {}) });
    await expect(client.request("/resource")).rejects.toMatchObject({ status, mensaje });
  });

  it("prefiere el error corto del backend sin adjuntar datos del proveedor", async () => {
    const client = createApiClient({
      fetch: async () => response(502, { error: "Azure no respondió", proveedor: { contenido: "privado" } }),
    });
    let error;
    try {
      await client.request("/extractInvoice");
    } catch (issue) {
      error = issue;
    }
    expect(error).toBeInstanceOf(ApiError);
    expect(error.mensaje).toBe("Azure no respondió");
    expect(JSON.stringify(error)).not.toContain("privado");
    expect(error).not.toHaveProperty("body");
  });

  it("mapea fallas de red y tiempos agotados", async () => {
    const network = createApiClient({ fetch: async () => { throw new Error("offline"); } });
    await expect(network.request("/health")).rejects.toMatchObject({
      status: 0,
      codigo: "red",
      mensaje: "No hay conexión con el servidor. Intenta de nuevo.",
    });

    const timeout = createApiClient({
      timeoutMs: 1,
      fetch: (_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      }),
    });
    await expect(timeout.request("/health")).rejects.toMatchObject({ codigo: "red" });
  });
});
