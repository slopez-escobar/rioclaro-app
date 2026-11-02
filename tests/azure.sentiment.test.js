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
});
