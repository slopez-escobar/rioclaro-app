import { apiClient } from "../../../shared/api/apiClient.js";

const UNAVAILABLE = {
  sentimiento: "sin_analizar",
  confianza: 0,
  frasesClave: [],
  origen: "no_disponible",
};

function isValidResult(result) {
  return ["positivo", "neutral", "negativo"].includes(result?.sentimiento)
    && typeof result.confianza === "number"
    && Number.isFinite(result.confianza)
    && result.confianza >= 0
    && result.confianza <= 1
    && Array.isArray(result.frasesClave)
    && result.frasesClave.every((phrase) => typeof phrase === "string")
    && typeof result.origen === "string";
}

/** Crea el adaptador remoto de Azure AI Language. */
export function createAzureSentiment({ client = apiClient } = {}) {
  return {
    async analyze(texto) {
      if (typeof texto !== "string" || texto.trim().length < 5) {
        throw new Error("Escribe al menos 5 caracteres para analizar el sentimiento.");
      }
      const input = texto.slice(0, 2000);
      try {
        const result = await client.request("/analyzeComplaint", {
          method: "POST",
          body: { texto: input },
        });
        return isValidResult(result) ? result : { ...UNAVAILABLE };
      } catch {
        return { ...UNAVAILABLE };
      }
    },
  };
}
