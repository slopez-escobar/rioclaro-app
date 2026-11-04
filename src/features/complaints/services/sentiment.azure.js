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
  const complaintCache = new Map();
  let requestQueue = Promise.resolve();

  function enqueue(texto) {
    const request = requestQueue.then(async () => {
      try {
        const result = await client.request("/analyzeComplaint", {
          method: "POST",
          body: { texto: texto.slice(0, 2000) },
        });
        return isValidResult(result) ? result : { ...UNAVAILABLE };
      } catch {
        return { ...UNAVAILABLE };
      }
    });
    requestQueue = request.then(() => undefined, () => undefined);
    return request;
  }

  async function analyze(texto) {
    if (typeof texto !== "string" || texto.trim().length < 5) {
      throw new Error("Escribe al menos 5 caracteres para analizar el sentimiento.");
    }
    return enqueue(texto);
  }

  return {
    analyze,
    analyzeForComplaint(idQueja, texto) {
      if (!complaintCache.has(idQueja)) {
        complaintCache.set(idQueja, analyze(texto));
      }
      return complaintCache.get(idQueja);
    },
    clearCache() {
      complaintCache.clear();
    },
  };
}
