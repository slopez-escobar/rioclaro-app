export class AzureRequestError extends Error {
  constructor(status, codigo, { providerCode, providerType } = {}) {
    super("Error en el servicio de Azure");
    this.name = "AzureRequestError";
    this.status = status;
    this.codigo = codigo;
    this.providerCode = providerCode;
    this.providerType = providerType;
  }
}

function metadataValue(value) {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  return String(value).slice(0, 120);
}

async function providerErrorMetadata(response) {
  let payload;
  try {
    payload = await response.json();
  } catch {
    return {};
  }

  const providerError = payload?.error ?? payload;
  const innerError = providerError?.innererror ?? providerError?.innerError;
  const providerCode = metadataValue(providerError?.code ?? innerError?.code);
  const providerType = metadataValue(providerError?.type ?? innerError?.type);
  return {
    ...(providerCode ? { providerCode } : {}),
    ...(providerType ? { providerType } : {}),
  };
}

function retryDelay(response, now) {
  const retryAfter = response.headers?.get?.("retry-after");
  if (!retryAfter) return 0;
  const seconds = Number(retryAfter);
  const delay = Number.isFinite(seconds)
    ? seconds * 1000
    : Date.parse(retryAfter) - now();
  return Math.min(3000, Math.max(0, Number.isFinite(delay) ? delay : 0));
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function azureFetch(url, {
  method = "GET",
  headers = {},
  body,
  timeoutMs = 30_000,
  fetch: fetchImplementation = globalThis.fetch,
  sleep = wait,
  now = Date.now,
} = {}) {
  if (typeof fetchImplementation !== "function") {
    throw new AzureRequestError(0, "FETCH_NO_DISPONIBLE");
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImplementation(url, {
        method,
        headers,
        ...(body === undefined ? {} : { body }),
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted || error?.name === "AbortError") {
        throw new AzureRequestError(0, "TIEMPO_AGOTADO");
      }
      throw new AzureRequestError(0, "ERROR_DE_RED");
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 429 || response.status >= 500) {
      if (attempt === 0) {
        await sleep(retryDelay(response, now));
        continue;
      }
    }
    if (response.status >= 400) {
      const metadata = await providerErrorMetadata(response);
      throw new AzureRequestError(
        response.status,
        response.status === 429 || response.status >= 500
          ? "SERVICIO_NO_DISPONIBLE"
          : "SOLICITUD_NO_PROCESADA",
        metadata,
      );
    }
    return response;
  }
  throw new AzureRequestError(502, "SERVICIO_NO_DISPONIBLE");
}

export function azureErrorResponse(error) {
  if (error?.status === 401 || error?.status === 403) {
    return { status: 502, jsonBody: { error: "Servicio de IA no autorizado" } };
  }
  if (error?.status === 404) {
    return { status: 502, jsonBody: { error: "Despliegue no encontrado" } };
  }
  if (error?.status === 429) {
    return { status: 429, jsonBody: { error: "El servicio está ocupado. Intenta de nuevo en unos segundos." } };
  }
  const contentErrorCodes = new Set([
    "contentfilter",
    "contentpolicyviolation",
    "contentmoderation",
    "responsibleaipolicyviolation",
  ]);
  const providerErrorCode = String(error?.providerCode ?? "").toLowerCase().replaceAll(/[_\-\s]/g, "");
  const providerErrorType = String(error?.providerType ?? "").toLowerCase().replaceAll(/[_\-\s]/g, "");
  if (
    error?.status === 400
    && (contentErrorCodes.has(providerErrorCode) || contentErrorCodes.has(providerErrorType))
  ) {
    return { status: 422, jsonBody: { error: "No se pudo procesar la solicitud" } };
  }
  return { status: 502, jsonBody: { error: "El servicio de Azure no respondió" } };
}
