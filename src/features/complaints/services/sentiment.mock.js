const NEGATIVE_TERMS = [
  "tarde", "retraso", "cancelaron", "cancelado", "sin avisar", "sin avisarme",
  "nadie", "molesto", "urgente", "otra vez", "nunca", "falso", "error",
  "no llegó", "no me", "cobro doble", "dos veces", "duplicado", "mal servicio",
  "queja", "reclamo",
];
const POSITIVE_TERMS = ["gracias", "excelente", "resuelto", "amable", "rápido"];
const KEY_PHRASES = [
  "sin existencia", "no había producto", "falta de existencia", "error de captura",
  "no me localizaron", "cliente no localizado", "cobro duplicado",
  "cancelaron mi pedido", "sin avisarme", "pedido urgente",
];

function normalizeText(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX");
}

function includesTerm(text, term) {
  const normalizedTerm = normalizeText(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${normalizedTerm}($|[^\\p{L}\\p{N}])`, "u").test(text);
}

/**
 * Crea un analizador de sentimiento léxico para desarrollo y pruebas.
 * @param {{delayMs?:number}} options Retraso opcional de simulación.
 * @returns {{analyze:(text:string)=>Promise<Object>}} Analizador simulado.
 */
export function createMockSentiment({ delayMs = 0 } = {}) {
  return {
    async analyze(texto) {
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
      const normalized = normalizeText(texto);
      const negative = NEGATIVE_TERMS.filter((term) => includesTerm(normalized, term)).length;
      const positive = POSITIVE_TERMS.filter((term) => includesTerm(normalized, term)).length;
      const score = negative - positive;
      const sentimiento = score >= 1 ? "negativo" : score <= -1 ? "positivo" : "neutral";
      const confianza = score === 0 ? 0.6 : Math.min(0.99, 0.55 + 0.1 * Math.abs(score));
      const frasesClave = KEY_PHRASES
        .filter((phrase) => includesTerm(normalized, phrase))
        .slice(0, 5);
      return { sentimiento, confianza, frasesClave, origen: "simulado" };
    },
  };
}
