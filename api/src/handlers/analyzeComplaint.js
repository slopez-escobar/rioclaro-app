import { azureErrorResponse, azureFetch } from "../lib/azureFetch.js";
import { can } from "../lib/permissions.js";
import { requireSession } from "../lib/auth.js";
import { recordRequest, rateLimitResponse, readProviderJson } from "../lib/endpoint.js";
import { fail, parseJsonBody } from "../lib/http.js";
import { createRateLimiter } from "../lib/rateLimit.js";

function timeValue(now) {
  return typeof now === "function" ? now() : now;
}

function normalizePhrase(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX")
    .trim();
}

function mapSentiment(sentimentResult, phraseResult) {
  const document = sentimentResult.results?.documents?.[0]
    ?? sentimentResult.documents?.[0];
  const phraseDocument = phraseResult.results?.documents?.[0]
    ?? phraseResult.documents?.[0];
  if (!document || !phraseDocument) {
    const error = new Error("Respuesta inválida del servicio de Azure");
    error.status = 502;
    error.codigo = "RESPUESTA_INVALIDA";
    throw error;
  }

  const sentiment = String(document.sentiment ?? "").toLowerCase();
  const mappedSentiment = sentiment === "positive"
    ? "positivo"
    : sentiment === "negative"
      ? "negativo"
      : "neutral";
  const confidenceKey = sentiment === "positive"
    ? "positive"
    : sentiment === "negative"
      ? "negative"
      : "neutral";
  const rawConfidence = document.confidenceScores?.[confidenceKey] ?? 0;
  const confidence = Number.isFinite(rawConfidence)
    ? Math.min(1, Math.max(0, rawConfidence))
    : 0;
  const seen = new Set();
  const phrases = [];
  for (const phrase of phraseDocument.keyPhrases ?? []) {
    const key = normalizePhrase(phrase);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    phrases.push(phrase);
    if (phrases.length === 5) break;
  }
  return {
    sentimiento: mappedSentiment,
    confianza: confidence,
    frasesClave: phrases,
    origen: "azure-language",
  };
}

export function createAnalyzeComplaintHandler({
  config,
  now = Date.now,
  fetch = globalThis.fetch,
  rateLimiter = createRateLimiter({ now: () => timeValue(now) }),
  request = azureFetch,
} = {}) {
  return async function analyzeComplaintHandler(httpRequest, context = {}) {
    const startedAt = timeValue(now);
    let response;
    let usuario = "anónimo";
    let size;
    try {
      const session = requireSession(httpRequest, { config, now });
      if (session?.status) {
        response = session;
        return response;
      }
      usuario = session.usuario;
      if (!can(session.rol, "quejas", "ver") && !can(session.rol, "quejas", "crear")) {
        response = fail(403, "Tu rol no tiene acceso a este servicio");
        return response;
      }
      if (!config.language.configurado) {
        response = fail(503, "Servicio no configurado");
        return response;
      }

      const limit = rateLimiter.check(session.usuario, { max: 40, ventanaMs: 10 * 60 * 1000 });
      if (!limit.permitido) {
        response = rateLimitResponse(limit);
        return response;
      }

      const parsed = await parseJsonBody(httpRequest);
      if (parsed.response) {
        response = parsed.response;
        return response;
      }
      const { texto } = parsed.body;
      if (typeof texto !== "string" || texto.length < 5 || texto.length > 2000) {
        response = fail(400, "Solicitud inválida");
        return response;
      }
      size = texto.length;
      const endpoint = `${config.language.endpoint}/language/:analyze-text?api-version=${encodeURIComponent(config.language.apiVersion)}`;
      const analyze = (kind) => request(endpoint, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": config.language.key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind,
          analysisInput: {
            documents: [{ id: "1", language: "es", text: texto }],
          },
        }),
        fetch,
      }).then(readProviderJson);

      let sentimentResult;
      let phraseResult;
      try {
        [sentimentResult, phraseResult] = await Promise.all([
          analyze("SentimentAnalysis"),
          analyze("KeyPhraseExtraction"),
        ]);
        response = { status: 200, jsonBody: mapSentiment(sentimentResult, phraseResult) };
      } catch (error) {
        response = azureErrorResponse(error);
      }
      return response;
    } catch {
      response = { status: 500, jsonBody: { error: "Error interno" } };
      return response;
    } finally {
      recordRequest(context, {
        endpoint: "/api/analyzeComplaint",
        usuario,
        status: response?.status ?? 500,
        startedAt,
        now,
        size,
      });
    }
  };
}
