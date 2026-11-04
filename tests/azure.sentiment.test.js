import { describe, expect, it, vi } from "vitest";
import { createAzureSentiment } from "../src/features/complaints/services/sentiment.azure.js";

const result = {
  sentimiento: "negativo",
  confianza: 0.94,
  frasesClave: ["entrega tardía"],
  origen: "azure-language",
};

describe("sentimiento Azure", () => {
  it("mapea la respuesta remota y recorta el texto a 2000 caracteres", async () => {
    const client = { request: vi.fn().mockResolvedValue(result) };
    await expect(createAzureSentiment({ client }).analyze("x".repeat(2050))).resolves.toEqual(result);
    expect(client.request).toHaveBeenCalledWith("/analyzeComplaint", {
      method: "POST",
      body: { texto: "x".repeat(2000) },
    });
  });

  it("exige cinco caracteres sin llamar al servicio", async () => {
    const client = { request: vi.fn() };
    await expect(createAzureSentiment({ client }).analyze("abcd"))
      .rejects.toThrow("Escribe al menos 5 caracteres");
    expect(client.request).not.toHaveBeenCalled();
  });

  it.each([
    new Error("offline"),
    { sentimiento: "invalido", confianza: 0.8, frasesClave: [], origen: "azure-language" },
    { sentimiento: "negativo", confianza: 4, frasesClave: [], origen: "azure-language" },
  ])("devuelve sin_analizar ante fallas o respuestas inválidas", async (failure) => {
    const client = { request: async () => { if (failure instanceof Error) throw failure; return failure; } };
    await expect(createAzureSentiment({ client }).analyze("texto válido"))
      .resolves.toEqual({ sentimiento: "sin_analizar", confianza: 0, frasesClave: [], origen: "no_disponible" });
  });

  it("cachea un intento por queja, incluidos los fallos", async () => {
    const client = { request: vi.fn().mockRejectedValue(new Error("offline")) };
    const analyzer = createAzureSentiment({ client });
    const first = analyzer.analyzeForComplaint("QJA-1", "La entrega llegó tarde.");
    const second = analyzer.analyzeForComplaint("QJA-1", "La entrega llegó tarde.");

    await expect(first).resolves.toMatchObject({ sentimiento: "sin_analizar" });
    await expect(second).resolves.toMatchObject({ sentimiento: "sin_analizar" });
    expect(client.request).toHaveBeenCalledOnce();
  });

  it("limita a una solicitud de Azure concurrente", async () => {
    let active = 0;
    let maxActive = 0;
    const client = {
      request: vi.fn(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return result;
      }),
    };
    const analyzer = createAzureSentiment({ client });

    await Promise.all([
      analyzer.analyzeForComplaint("QJA-1", "La entrega llegó tarde."),
      analyzer.analyzeForComplaint("QJA-2", "El pedido llegó completo."),
    ]);

    expect(maxActive).toBe(1);
    expect(client.request).toHaveBeenCalledTimes(2);
  });
});
