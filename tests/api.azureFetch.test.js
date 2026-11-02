import { describe, expect, it, vi } from "vitest";
import { azureFetch, AzureRequestError } from "../api/src/lib/azureFetch.js";

describe("azureFetch", () => {
  it("reintenta una sola vez 429 y espera como máximo tres segundos", async () => {
    let calls = 0;
    const waits = [];
    const response = await azureFetch("https://azure.test", {
      fetch: async () => {
        calls += 1;
        return calls === 1
          ? new Response("no registrar", { status: 429, headers: { "retry-after": "9" } })
          : new Response("{}", { status: 200 });
      },
      sleep: async (milliseconds) => waits.push(milliseconds),
    });

    expect(response.status).toBe(200);
    expect(calls).toBe(2);
    expect(waits).toEqual([3000]);
  });

  it("normaliza errores del proveedor y nunca expone su cuerpo", async () => {
    const fetch = vi.fn(async () => new Response("contenido privado", { status: 503 }));
    await expect(azureFetch("https://azure.test", {
      fetch,
      sleep: async () => {},
    })).rejects.toMatchObject({ status: 503, codigo: "SERVICIO_NO_DISPONIBLE" });
    expect(fetch).toHaveBeenCalledTimes(2);

    let normalizedError;
    try {
      await azureFetch("https://azure.test", {
        fetch: async () => new Response("detalle secreto", { status: 400 }),
      });
    } catch (error) {
      normalizedError = error;
    }
    expect(normalizedError).toBeInstanceOf(AzureRequestError);
    expect(normalizedError).toMatchObject({ status: 400, codigo: "SOLICITUD_NO_PROCESADA" });
    expect(normalizedError.message).not.toContain("detalle secreto");
  });

  it("normaliza un timeout de AbortController", async () => {
    const fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => {
        const error = new Error("secreto de red");
        error.name = "AbortError";
        reject(error);
      });
    });
    await expect(azureFetch("https://azure.test", { fetch, timeoutMs: 2 }))
      .rejects.toMatchObject({ status: 0, codigo: "TIEMPO_AGOTADO" });
  });
});
