import { azureErrorResponse, azureFetch } from "../lib/azureFetch.js";
import { requireSession } from "../lib/auth.js";
import { recordRequest, rateLimitResponse } from "../lib/endpoint.js";
import { fail } from "../lib/http.js";
import { createRateLimiter } from "../lib/rateLimit.js";

function timeValue(now) {
  return typeof now === "function" ? now() : now;
}

export function createSpeechTokenHandler({
  config,
  now = Date.now,
  fetch = globalThis.fetch,
  rateLimiter = createRateLimiter({ now: () => timeValue(now) }),
  request = azureFetch,
} = {}) {
  return async function speechTokenHandler(httpRequest, context = {}) {
    const startedAt = timeValue(now);
    let response;
    let usuario = "anónimo";
    try {
      const session = requireSession(httpRequest, {
        config,
        now,
        roles: [{ modulo: "asistente_ia", accion: "usar" }],
      });
      if (session?.status) {
        response = session;
        return response;
      }
      usuario = session.usuario;
      if (!config.speech.configurado) {
        response = fail(503, "Servicio no configurado");
        return response;
      }
      const limit = rateLimiter.check(session.usuario, { max: 20, ventanaMs: 10 * 60 * 1000 });
      if (!limit.permitido) {
        response = rateLimitResponse(limit);
        return response;
      }

      const endpoint = `https://${config.speech.region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
      let providerResponse;
      try {
        providerResponse = await request(endpoint, {
          method: "POST",
          headers: {
            "Ocp-Apim-Subscription-Key": config.speech.key,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: "",
          fetch,
        });
      } catch (error) {
        response = azureErrorResponse(error);
        return response;
      }
      let token;
      try {
        token = await providerResponse.text();
      } catch {
        response = { status: 502, jsonBody: { error: "El servicio de Azure no respondió" } };
        return response;
      }
      if (!token) {
        response = { status: 502, jsonBody: { error: "El servicio de Azure no respondió" } };
        return response;
      }
      response = {
        status: 200,
        jsonBody: {
          token,
          region: config.speech.region,
          expiraEnSegundos: 540,
        },
      };
      return response;
    } catch {
      response = { status: 500, jsonBody: { error: "Error interno" } };
      return response;
    } finally {
      recordRequest(context, {
        endpoint: "/api/speechToken",
        usuario,
        status: response?.status ?? 500,
        startedAt,
        now,
      });
    }
  };
}
