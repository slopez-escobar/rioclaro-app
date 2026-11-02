import { azureErrorResponse, azureFetch } from "../lib/azureFetch.js";
import { requireSession } from "../lib/auth.js";
import { recordRequest, rateLimitResponse, readProviderJson } from "../lib/endpoint.js";
import { fail, parseJsonBody } from "../lib/http.js";
import { createRateLimiter } from "../lib/rateLimit.js";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_BODY_BYTES = 14 * 1024 * 1024;
const RFC_PATTERN = /[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}/g;
const MIME_EXTENSIONS = new Map([
  ["application/pdf", [".pdf"]],
  ["image/jpeg", [".jpg", ".jpeg"]],
  ["image/png", [".png"]],
]);

function timeValue(now) {
  return typeof now === "function" ? now() : now;
}

function extracted(value, confidence = 0) {
  const resolvedValue = value ?? null;
  return {
    valor: resolvedValue,
    confianza: resolvedValue === null || !Number.isFinite(confidence)
      ? 0
      : Math.min(1, Math.max(0, confidence)),
  };
}

function contentValue(field, primaryValue) {
  if (!field) return null;
  const value = field[primaryValue];
  const result = value === undefined || value === null || value === ""
    ? field.content ?? null
    : value;
  return result === "" ? null : result;
}

function numberFromText(value) {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return null;
  const commaIndex = cleaned.lastIndexOf(",");
  const dotIndex = cleaned.lastIndexOf(".");
  const normalized = commaIndex >= 0 && dotIndex >= 0
    ? commaIndex > dotIndex
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "")
    : commaIndex >= 0
      ? cleaned.replace(",", ".")
      : cleaned;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Number(amount.toFixed(2)) : null;
}

function mapInvoice(result, { name, apiVersion, startedAt, now, receptorRfc }) {
  const analyzeResult = result?.analyzeResult;
  const fields = analyzeResult?.documents?.[0]?.fields ?? {};
  const vendor = fields.VendorName;
  const vendorTaxId = fields.VendorTaxId;
  const invoiceId = fields.InvoiceId;
  const invoiceDate = fields.InvoiceDate;
  const invoiceTotal = fields.InvoiceTotal;

  const fieldRfc = contentValue(vendorTaxId, "valueString");
  let rfc = null;
  let rfcConfidence = 0;
  let rfcOrigen = "ninguno";
  if (typeof fieldRfc === "string" && /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/.test(fieldRfc)) {
    rfc = fieldRfc;
    rfcConfidence = vendorTaxId.confidence;
    rfcOrigen = "campo";
  } else {
    const candidates = new Set(
      [...String(analyzeResult?.content ?? "").toUpperCase().matchAll(RFC_PATTERN)]
        .map(([candidate]) => candidate)
        .filter((candidate) => candidate !== String(receptorRfc ?? "").toUpperCase()),
    );
    if (candidates.size === 1) {
      [rfc] = candidates;
      rfcConfidence = 0.85;
      rfcOrigen = "texto";
    }
  }

  const dateValue = invoiceDate?.valueDate;
  const totalCurrency = invoiceTotal?.valueCurrency?.amount;
  const totalContent = invoiceTotal?.content;
  const total = Number.isFinite(totalCurrency)
    ? Number(totalCurrency.toFixed(2))
    : numberFromText(totalContent);
  const duration = Math.max(0, timeValue(now) - startedAt);

  return {
    proveedor: extracted(contentValue(vendor, "valueString"), vendor?.confidence),
    rfc: extracted(rfc, rfcConfidence),
    folio: extracted(contentValue(invoiceId, "valueString"), invoiceId?.confidence),
    fecha: extracted(
      typeof dateValue === "string" ? dateValue : contentValue(invoiceDate, "valueDate"),
      invoiceDate?.confidence,
    ),
    total: extracted(total, total === null ? 0 : invoiceTotal?.confidence),
    meta: {
      origen: "azure-document-intelligence",
      modelo: "prebuilt-invoice",
      apiVersion,
      tiempoMs: duration,
      rfcOrigen,
      archivo: name,
    },
  };
}

function isValidBase64(value) {
  if (
    typeof value !== "string"
    || !value
    || value.length % 4 === 1
    || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)
  ) {
    return false;
  }
  return Buffer.from(value, "base64").toString("base64").replace(/=+$/, "")
    === value.replace(/=+$/, "");
}

function invalidFile(name, type, base64) {
  if (typeof name !== "string" || typeof type !== "string" || !isValidBase64(base64)) {
    return fail(400, "Solicitud inválida");
  }
  const extensions = MIME_EXTENSIONS.get(type.toLowerCase());
  if (
    !extensions
    || !extensions.includes(name.slice(name.lastIndexOf(".")).toLowerCase())
  ) {
    return fail(415, "Formato no admitido");
  }
  const bytes = Buffer.from(base64, "base64");
  if (!bytes.length) return fail(400, "Solicitud inválida");
  if (bytes.length > MAX_FILE_BYTES) return fail(413, "El archivo supera 10 MB");
  return { bytes };
}

export function createExtractInvoiceHandler({
  config,
  now = Date.now,
  fetch = globalThis.fetch,
  rateLimiter = createRateLimiter({ now: () => timeValue(now) }),
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  pollIntervalMs = 1500,
  maxWaitMs = 60_000,
  request = azureFetch,
} = {}) {
  return async function extractInvoiceHandler(httpRequest, context = {}) {
    const startedAt = timeValue(now);
    let response;
    let usuario = "anónimo";
    let size;
    try {
      const session = requireSession(httpRequest, {
        config,
        now,
        roles: [{ modulo: "facturas_proveedores", accion: "crear" }],
      });
      if (session?.status) {
        response = session;
        return response;
      }
      usuario = session.usuario;

      if (!config.docIntelligence.configurado) {
        response = fail(503, "Servicio no configurado");
        return response;
      }

      const limit = rateLimiter.check(session.usuario, { max: 20, ventanaMs: 10 * 60 * 1000 });
      if (!limit.permitido) {
        response = rateLimitResponse(limit);
        return response;
      }

      const parsed = await parseJsonBody(httpRequest, {
        maxBytes: MAX_BODY_BYTES,
        tooLargeMessage: "El archivo supera 10 MB",
      });
      if (parsed.response) {
        response = parsed.response;
        return response;
      }
      const { nombre, tipo, base64 } = parsed.body;
      const fileResult = invalidFile(nombre, tipo, base64);
      if (fileResult.status) {
        response = fileResult;
        return response;
      }
      size = fileResult.bytes.length;

      const apiVersion = config.docIntelligence.apiVersion;
      const endpoint = `${config.docIntelligence.endpoint}/documentintelligence/documentModels/prebuilt-invoice:analyze?api-version=${encodeURIComponent(apiVersion)}`;
      const requestFetch = (url, options) => request(url, { ...options, fetch });
      let initial;
      try {
        initial = await requestFetch(endpoint, {
          method: "POST",
          headers: {
            "Ocp-Apim-Subscription-Key": config.docIntelligence.key,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ base64Source: base64 }),
        });
      } catch (error) {
        response = azureErrorResponse(error);
        return response;
      }
      if (initial.status !== 202) {
        response = { status: 502, jsonBody: { error: "El servicio de Azure no respondió" } };
        return response;
      }

      const operationLocation = initial.headers.get("operation-location");
      if (!operationLocation) {
        response = { status: 502, jsonBody: { error: "El servicio de Azure no respondió" } };
        return response;
      }
      let sameOrigin = false;
      try {
        sameOrigin = new URL(operationLocation).origin
          === new URL(config.docIntelligence.endpoint).origin;
      } catch {
        sameOrigin = false;
      }
      if (!sameOrigin) {
        response = { status: 502, jsonBody: { error: "El servicio de Azure no respondió" } };
        return response;
      }

      let result;
      let sleptMs = 0;
      const elapsedMs = () => Math.max(timeValue(now) - startedAt, sleptMs);
      while (elapsedMs() < maxWaitMs) {
        const remaining = maxWaitMs - elapsedMs();
        const delay = Math.min(pollIntervalMs, remaining);
        await sleep(delay);
        sleptMs += delay;
        if (elapsedMs() >= maxWaitMs) break;

        let pollResponse;
        try {
          pollResponse = await requestFetch(operationLocation, {
            method: "GET",
            headers: { "Ocp-Apim-Subscription-Key": config.docIntelligence.key },
            timeoutMs: Math.min(30_000, maxWaitMs - elapsedMs()),
          });
        } catch (error) {
          if (
            error?.codigo === "TIEMPO_AGOTADO"
            && elapsedMs() >= maxWaitMs
          ) {
            response = fail(504, "La lectura tardó demasiado");
            return response;
          }
          response = azureErrorResponse(error);
          return response;
        }
        let pollResult;
        try {
          pollResult = await readProviderJson(pollResponse);
        } catch (error) {
          response = azureErrorResponse(error);
          return response;
        }
        const status = String(pollResult.status ?? "").toLowerCase();
        if (status === "succeeded") {
          result = pollResult;
          break;
        }
        if (status === "failed") {
          response = fail(422, "No se pudo leer la factura");
          return response;
        }
      }
      if (!result) {
        response = fail(504, "La lectura tardó demasiado");
        return response;
      }

      response = { status: 200, jsonBody: mapInvoice(result, {
        name: nombre,
        apiVersion,
        startedAt,
        now,
        receptorRfc: config.receptorRfc ?? config.RECEPTOR_RFC,
      }) };
      return response;
    } catch (error) {
      response = { status: 500, jsonBody: { error: "Error interno" } };
      return response;
    } finally {
      recordRequest(context, {
        endpoint: "/api/extractInvoice",
        usuario,
        status: response?.status ?? 500,
        startedAt,
        now,
        size,
      });
    }
  };
}
