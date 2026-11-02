import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createExtractInvoiceHandler } from "../api/src/handlers/extractInvoice.js";
import { signToken } from "../api/src/lib/tokens.js";

const secret = "b2-2-secret-for-test-only-0000000000";
const now = 1000;
const config = {
  tokenSecret: secret,
  docIntelligence: {
    configurado: true,
    endpoint: "https://docint.test",
    key: "doc-key-for-test",
    apiVersion: "2024-11-30",
  },
  receptorRfc: "DRC0401127K2",
};
const fixtures = Object.fromEntries(
  [
    "full",
    "rfc-text",
    "rfc-multiple",
    "unreadable-total",
    "failed",
  ].map((name) => [
    name,
    JSON.parse(readFileSync(new URL(`./fixtures/document-intelligence-${name}.json`, import.meta.url))),
  ]),
);

function tokenFor(rol = "finanzas", usuario = "laura") {
  return signToken({
    usuario,
    nombre: usuario,
    rol,
    idSucursal: "gdl",
    idCliente: null,
  }, secret, { now });
}

function request(body, token = tokenFor()) {
  return {
    headers: { get: (name) => name.toLowerCase() === "authorization" ? `Bearer ${token}` : null },
    json: async () => body,
    query: { get: () => null },
    method: "POST",
    url: "http://localhost/api/extractInvoice",
  };
}

function fileBody(name = "factura.pdf", tipo = "application/pdf", base64 = "ZmFrZQ==") {
  return { nombre: name, tipo, base64 };
}

function createHandler(result, options = {}) {
  let time = now;
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    if (init.method === "POST") {
      return new Response(null, {
        status: 202,
        headers: { "operation-location": "https://docint.test/operation/1" },
      });
    }
    return new Response(JSON.stringify(result), { status: 200 });
  };
  const handler = createExtractInvoiceHandler({
    config,
    now: () => time,
    fetch,
    sleep: async (milliseconds) => { time += milliseconds; },
    ...options,
  });
  return { handler, calls, setTime: (value) => { time = value; } };
}

describe("POST /api/extractInvoice", () => {
  it("mapea la factura completa al contrato del extractor simulado", async () => {
    const { handler, calls } = createHandler(fixtures.full);
    const response = await handler(request(fileBody()));
    expect(response.status).toBe(200);
    expect(Object.keys(response.jsonBody)).toEqual([
      "proveedor", "rfc", "folio", "fecha", "total", "meta",
    ]);
    expect(response.jsonBody).toMatchObject({
      proveedor: { valor: "Cloros y Derivados Occidente S.A.P.I. de C.V.", confianza: 0.98 },
      rfc: { valor: "CDO920402DFT", confianza: 0.97 },
      folio: { valor: "A-8841", confianza: 0.95 },
      fecha: { valor: "2026-10-06", confianza: 0.94 },
      total: { valor: 10750.76, confianza: 0.99 },
      meta: {
        origen: "azure-document-intelligence",
        modelo: "prebuilt-invoice",
        apiVersion: "2024-11-30",
        rfcOrigen: "campo",
        archivo: "factura.pdf",
      },
    });

    expect(response.jsonBody.meta.tiempoMs).toBe(1500);
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe(
      "https://docint.test/documentintelligence/documentModels/prebuilt-invoice:analyze?api-version=2024-11-30",
    );
    expect(calls[0].init.headers["Ocp-Apim-Subscription-Key"]).toBe(config.docIntelligence.key);
    expect(JSON.parse(calls[0].init.body)).toEqual({ base64Source: "ZmFrZQ==" });
    expect(JSON.stringify(response)).not.toContain(fixtures.full.analyzeResult.content);
    expect(JSON.stringify(response)).not.toContain("ZmFrZQ==");
  });

  it("rechaza operation-location ajeno sin enviarle la llave", async () => {
    const calls = [];
    const handler = createExtractInvoiceHandler({
      config,
      now,
      fetch: async (url, init) => {
        calls.push({ url, init });
        return new Response(null, {
          status: 202,
          headers: { "operation-location": "https://attacker.test/collect" },
        });
      },
    });
    expect(await handler(request(fileBody()))).toMatchObject({
      status: 502,
      jsonBody: { error: "El servicio de Azure no respondió" },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).not.toContain("attacker.test");
    expect(calls[0].init.headers["Ocp-Apim-Subscription-Key"]).toBe(config.docIntelligence.key);
  });

  it("usa RFC de texto solo cuando queda exactamente un candidato no receptor", async () => {
    const onlyCandidate = createHandler(fixtures["rfc-text"]);
    const response = await onlyCandidate.handler(request(fileBody()));
    expect(response.jsonBody.rfc).toEqual({ valor: "PNX171102BHQ", confianza: 0.85 });
    expect(response.jsonBody.meta.rfcOrigen).toBe("texto");
    expect(response.jsonBody.fecha.valor).toBe("08/10/2026");
    expect(response.jsonBody.total.valor).toBe(5923.84);

    const multipleCandidates = createHandler(fixtures["rfc-multiple"]);
    const multipleResponse = await multipleCandidates.handler(request(fileBody()));
    expect(multipleResponse.jsonBody.rfc).toEqual({ valor: null, confianza: 0 });
    expect(multipleResponse.jsonBody.meta.rfcOrigen).toBe("ninguno");
    expect(multipleResponse.jsonBody.folio).toEqual({ valor: null, confianza: 0 });
  });

  it("mantiene la confianza real de campos poco legibles y no inventa campos ausentes", async () => {
    const { handler } = createHandler(fixtures["unreadable-total"]);
    const response = await handler(request(fileBody()));
    expect(response.jsonBody.total).toEqual({ valor: 16330.94, confianza: 0.41 });

    const absent = createHandler({
      status: "succeeded",
      analyzeResult: { documents: [{ fields: {} }] },
    });
    expect((await absent.handler(request(fileBody()))).jsonBody).toMatchObject({
      proveedor: { valor: null, confianza: 0 },
      rfc: { valor: null, confianza: 0 },
      folio: { valor: null, confianza: 0 },
      fecha: { valor: null, confianza: 0 },
      total: { valor: null, confianza: 0 },
    });
  });

  it("espera respuestas pendientes, rechaza fallas y limita el tiempo total", async () => {
    let time = now;
    let poll = 0;
    const pendingThenSuccess = createExtractInvoiceHandler({
      config,
      now: () => time,
      sleep: async (milliseconds) => { time += milliseconds; },
      fetch: async (_url, init) => {
        if (init.method === "POST") {
          return new Response(null, {
            status: 202,
            headers: { "operation-location": "https://docint.test/op" },
          });
        }
        poll += 1;
        return new Response(JSON.stringify(poll === 1
          ? { status: "running" }
          : fixtures.full), { status: 200 });
      },
    });
    expect((await pendingThenSuccess(request(fileBody()))).status).toBe(200);
    expect(poll).toBe(2);

    const failed = createHandler(fixtures.failed);
    expect(await failed.handler(request(fileBody()))).toMatchObject({
      status: 422,
      jsonBody: { error: "No se pudo leer la factura" },
    });
    expect(JSON.stringify(await failed.handler(request(fileBody()))))
      .not.toContain("Contenido sintético");

    let timeoutTime = now;
    const timeout = createExtractInvoiceHandler({
      config,
      now: () => timeoutTime,
      sleep: async (milliseconds) => { timeoutTime += milliseconds; },
      maxWaitMs: 3000,
      fetch: async (_url, init) => init.method === "POST"
        ? new Response(null, {
          status: 202,
          headers: { "operation-location": "https://docint.test/op" },
        })
        : new Response(JSON.stringify({ status: "running" }), { status: 200 }),
    });
    expect(await timeout(request(fileBody()))).toMatchObject({
      status: 504,
      jsonBody: { error: "La lectura tardó demasiado" },
    });
  });

  it("valida permisos, formato, tamaño, configuración y limita peticiones", async () => {
    const denied = createHandler(fixtures.full);
    expect(await denied.handler(request(fileBody(), tokenFor("ventas", "tono"))))
      .toMatchObject({ status: 403 });
    expect(await denied.handler({
      ...request(fileBody()),
      headers: { get: () => null },
    })).toMatchObject({ status: 401 });
    expect(await denied.handler(request(fileBody("foto.png", "image/jpeg"))))
      .toMatchObject({ status: 415, jsonBody: { error: "Formato no admitido" } });
    expect(await denied.handler(request(fileBody("foto.exe", "application/pdf"))))
      .toMatchObject({ status: 415 });

    const tooLarge = denied.handler(request(fileBody(
      "grande.pdf",
      "application/pdf",
      "A".repeat(14_000_000),
    )));
    expect(await tooLarge).toMatchObject({
      status: 413,
      jsonBody: { error: "El archivo supera 10 MB" },
    });

    const unconfigured = createExtractInvoiceHandler({
      config: { ...config, docIntelligence: { configurado: false } },
      now,
      fetch: async () => { throw new Error("No debe llamar al proveedor"); },
    });
    expect(await unconfigured(request(fileBody()))).toMatchObject({
      status: 503,
      jsonBody: { error: "Servicio no configurado" },
    });

    const limitedLimiter = {
      check: () => ({ permitido: false, reintentarEnSegundos: 30 }),
    };
    const limited = createExtractInvoiceHandler({
      config,
      now,
      rateLimiter: limitedLimiter,
      fetch: async () => { throw new Error("No debe llamar al proveedor"); },
    });
    expect(await limited(request(fileBody()))).toMatchObject({
      status: 429,
      headers: { "retry-after": "30" },
    });

    const providerBusy = createExtractInvoiceHandler({
      config,
      now,
      request: async () => { throw { status: 429, codigo: "SERVICIO_NO_DISPONIBLE" }; },
    });
    expect(await providerBusy(request(fileBody()))).toMatchObject({
      status: 429,
      jsonBody: { error: "El servicio está ocupado. Intenta de nuevo en unos segundos." },
    });
  });

  it("permite finanzas y compras y registra solo metadatos", async () => {
    const logs = [];
    const finance = createHandler(fixtures.full);
    expect((await finance.handler(request(fileBody()), { log: (entry) => logs.push(entry) })).status)
      .toBe(200);
    const purchasing = createHandler(fixtures.full);
    expect((await purchasing.handler(request(fileBody(), tokenFor("compras", "ana")))).status)
      .toBe(200);
    const logText = JSON.stringify(logs);
    expect(logText).toContain("/api/extractInvoice");
    expect(logText).not.toContain(config.docIntelligence.key);
    expect(logText).not.toContain("ZmFrZQ==");
    expect(logText).not.toContain(fixtures.full.analyzeResult.content);
  });
});
