import { describe, expect, it } from "vitest";
import { createAnalyzeComplaintHandler } from "../api/src/handlers/analyzeComplaint.js";
import { createSpeechTokenHandler } from "../api/src/handlers/speechToken.js";
import { signToken } from "../api/src/lib/tokens.js";
import { usuarios } from "../api/data/usuarios.json";

const secret = "b2-2-secret-for-test-only-0000000000";
const now = 1000;
const languageConfig = {
  tokenSecret: secret,
  language: {
    configurado: true,
    endpoint: "https://language.test",
    key: "language-key-for-test",
    apiVersion: "2023-04-01",
  },
};
const speechConfig = {
  tokenSecret: secret,
  speech: {
    configurado: true,
    region: "eastus",
    key: "speech-key-for-test",
  },
};

function tokenFor(rol = "gerente_sucursal", username = "mariana") {
  const user = usuarios.find((item) => item.usuario === username);
  return signToken({
    usuario: user?.usuario ?? username,
    nombre: user?.nombre ?? "Nombre de prueba",
    rol,
    idSucursal: user?.idSucursal ?? "leo",
    idCliente: user?.idCliente ?? null,
  }, secret, { now });
}

function request(body, token = tokenFor(), endpoint) {
  return {
    headers: {
      get: (name) => {
        if (name.toLowerCase() === "authorization") return `Bearer ${token}`;
        return null;
      },
    },
    json: async () => body,
    query: { get: () => null },
    method: "POST",
    url: `http://localhost/api/${endpoint}`,
  };
}

function languageHandler(sentiment, phraseResponse, options = {}) {
  const calls = [];
  const handler = createAnalyzeComplaintHandler({
    config: languageConfig,
    now,
    fetch: async (url, init) => {
      calls.push({ url, init, body: JSON.parse(init.body) });
      return new Response(JSON.stringify(
        init.body.includes("SentimentAnalysis") ? sentiment : phraseResponse,
      ), { status: 200 });
    },
    ...options,
  });
  return { handler, calls };
}

function sentimentResult(sentiment, confidenceScores) {
  return {
    results: {
      documents: [{ sentiment, confidenceScores }],
    },
  };
}

const phrases = {
  results: {
    documents: [{
      keyPhrases: ["pedido cancelado", "Sin avisarme", "pedido cancelado", "respuesta"],
    }],
  },
};

describe("POST /api/analyzeComplaint", () => {
  it.each([
    ["positive", "positivo", 0.8],
    ["neutral", "neutral", 0.6],
    ["negative", "negativo", 0.9],
    ["mixed", "neutral", 0.6],
  ])("mapea sentimiento %s", async (input, expected, confidence) => {
    const { handler, calls } = languageHandler(
      sentimentResult(input, { positive: 0.8, neutral: 0.6, negative: 0.9 }),
      phrases,
    );
    const response = await handler(request(
      { texto: "Cancelaron mi pedido sin avisarme y nadie me contestó" },
      tokenFor(),
      "analyzeComplaint",
    ));
    expect(response.status).toBe(200);
    expect(response.jsonBody).toEqual({
      sentimiento: expected,
      confianza: confidence,
      frasesClave: ["pedido cancelado", "Sin avisarme", "respuesta"],
      origen: "azure-language",
    });
    expect(calls).toHaveLength(2);
    expect(calls.every(({ url }) =>
      url === "https://language.test/language/:analyze-text?api-version=2023-04-01",
    )).toBe(true);
    expect(calls.map(({ body }) => body.kind).sort())
      .toEqual(["KeyPhraseExtraction", "SentimentAnalysis"]);
    expect(calls.every(({ body }) => body.analysisInput.documents[0].language === "es")).toBe(true);
    expect(calls.every(({ init }) =>
      init.headers["Ocp-Apim-Subscription-Key"] === languageConfig.language.key,
    )).toBe(true);
  });

  it("autoriza solo roles con permisos, valida longitud y protege logs", async () => {
    const { handler } = languageHandler(
      sentimentResult("negative", { negative: 0.91 }),
      phrases,
    );
    expect(await handler(request({ texto: "hola" }, tokenFor(), "analyzeComplaint")))
      .toMatchObject({ status: 400 });
    expect(await handler(request(
      { texto: "x".repeat(2001) },
      tokenFor(),
      "analyzeComplaint",
    ))).toMatchObject({ status: 400 });
    expect(await handler(request(
      { texto: "texto de prueba suficiente" },
      tokenFor("finanzas", "laura"),
      "analyzeComplaint",
    ))).toMatchObject({ status: 403 });
    expect((await handler(request(
      { texto: "texto de prueba suficiente" },
      tokenFor("cliente", "cliente1"),
      "analyzeComplaint",
    ))).status).toBe(200);
    expect((await handler(request(
      { texto: "texto de prueba suficiente" },
      tokenFor(),
      "analyzeComplaint",
    ))).status).toBe(200);
    expect(await handler(request({ texto: "sin token" }, "", "analyzeComplaint")))
      .toMatchObject({ status: 401 });

    const logEntries = [];
    const spy = languageHandler(
      sentimentResult("negative", { negative: 0.91 }),
      phrases,
    );
    const complaint = "contenido confidencial de la queja";
    await spy.handler(request({ texto: complaint }), { log: (entry) => logEntries.push(entry) });
    expect(JSON.stringify(logEntries)).not.toContain(complaint);
    expect(JSON.stringify(logEntries)).not.toContain(languageConfig.language.key);
  });

  it("responde 503 si Language no está configurado y 429 al exceder el límite", async () => {
    const unconfigured = createAnalyzeComplaintHandler({
      config: { ...languageConfig, language: { configurado: false } },
      now,
      fetch: async () => { throw new Error("No debe llamar al proveedor"); },
    });
    expect(await unconfigured(request(
      { texto: "texto de prueba" },
      tokenFor(),
      "analyzeComplaint",
    ))).toMatchObject({ status: 503, jsonBody: { error: "Servicio no configurado" } });

    const limited = createAnalyzeComplaintHandler({
      config: languageConfig,
      now,
      rateLimiter: { check: () => ({ permitido: false, reintentarEnSegundos: 12 }) },
      fetch: async () => { throw new Error("No debe llamar al proveedor"); },
    });
    expect(await limited(request(
      { texto: "texto de prueba" },
      tokenFor(),
      "analyzeComplaint",
    ))).toMatchObject({ status: 429, headers: { "retry-after": "12" } });
  });
});

describe("POST /api/speechToken", () => {
  it("devuelve el token efímero y región sin exponer la llave", async () => {
    const calls = [];
    const handler = createSpeechTokenHandler({
      config: speechConfig,
      now,
      fetch: async (url, init) => {
        calls.push({ url, init });
        return new Response("short-lived-speech-token", { status: 200 });
      },
    });
    const response = await handler(request({}, tokenFor(), "speechToken"));
    expect(response).toEqual({
      status: 200,
      jsonBody: {
        token: "short-lived-speech-token",
        region: "eastus",
        expiraEnSegundos: 540,
      },
    });
    expect(calls[0].url).toBe(
      "https://eastus.api.cognitive.microsoft.com/sts/v1.0/issueToken",
    );
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.body).toBe("");
    expect(calls[0].init.headers["Ocp-Apim-Subscription-Key"]).toBe(speechConfig.speech.key);
    expect(JSON.stringify(response)).not.toContain(speechConfig.speech.key);
  });

  it("protege sesión, permiso, servicio, límite y logs", async () => {
    const noTokenHandler = createSpeechTokenHandler({
      config: speechConfig,
      now,
      fetch: async () => new Response("token", { status: 200 }),
    });
    expect(await noTokenHandler(request({}, "", "speechToken"))).toMatchObject({ status: 401 });
    expect(await noTokenHandler(request({}, tokenFor("rol_invalido", "test"), "speechToken")))
      .toMatchObject({ status: 403 });

    const unconfigured = createSpeechTokenHandler({
      config: { ...speechConfig, speech: { configurado: false } },
      now,
      fetch: async () => { throw new Error("No debe llamar al proveedor"); },
    });
    expect(await unconfigured(request({}, tokenFor(), "speechToken")))
      .toMatchObject({ status: 503, jsonBody: { error: "Servicio no configurado" } });

    const limited = createSpeechTokenHandler({
      config: speechConfig,
      now,
      rateLimiter: { check: () => ({ permitido: false, reintentarEnSegundos: 9 }) },
      fetch: async () => { throw new Error("No debe llamar al proveedor"); },
    });
    expect(await limited(request({}, tokenFor(), "speechToken")))
      .toMatchObject({ status: 429 });

    const logs = [];
    await noTokenHandler(request({}, tokenFor(), "speechToken"), {
      log: (entry) => logs.push(entry),
    });
    expect(JSON.stringify(logs)).not.toContain(speechConfig.speech.key);
    expect(JSON.stringify(logs)).not.toContain("short-lived-speech-token");
  });
});
