import { API_BASE_URL } from "../../config/env.js";
import { STORAGE_KEYS } from "../../config/constants.js";
import { localStore } from "../storage/localStore.js";
import { logout } from "../../features/auth/authService.js";
import { DEMO_RESET_EVENT } from "../../features/demo/demoService.js";

const DEFAULT_MESSAGES = {
  401: "Tu sesión venció. Vuelve a entrar.",
  403: "Tu rol no tiene acceso a este servicio.",
  413: "El archivo supera el tamaño permitido.",
  429: "El servicio está ocupado. Intenta de nuevo en unos segundos.",
};

export class ApiError extends Error {
  constructor({ status, mensaje, codigo }) {
    super(mensaje);
    this.name = "ApiError";
    this.status = status;
    this.mensaje = mensaje;
    this.codigo = codigo;
  }
}

function errorMessage(status, payload) {
  if (typeof payload?.error === "string" && payload.error.trim().length <= 180) {
    return payload.error.trim();
  }
  if (DEFAULT_MESSAGES[status]) return DEFAULT_MESSAGES[status];
  if (status >= 500) return "El servicio no respondió. Intenta de nuevo.";
  return "No se pudo completar la solicitud.";
}

function errorCode(status) {
  if (status === 401) return "no_autorizado";
  if (status === 403) return "sin_permiso";
  if (status === 413) return "archivo_grande";
  if (status === 429) return "limite";
  if (status >= 500) return "servicio";
  return "http";
}

/** Crea un cliente JSON con token opcional, timeout y errores normalizados. */
export function createApiClient({
  fetch: fetchImplementation = globalThis.fetch,
  baseUrl = API_BASE_URL,
  getToken = () => null,
  onUnauthorized = () => {},
  timeoutMs = 30_000,
} = {}) {
  const root = String(baseUrl || "/api").replace(/\/+$/, "");

  async function request(ruta, {
    method = "GET",
    body,
    headers = {},
    timeoutMs: requestTimeout = timeoutMs,
  } = {}) {
    const requestHeaders = { ...headers };
    if (body !== undefined && !Object.keys(requestHeaders).some((key) => key.toLowerCase() === "content-type")) {
      requestHeaders["Content-Type"] = "application/json";
    }
    const token = getToken();
    if (token) requestHeaders.Authorization = `Bearer ${token}`;

    const controller = typeof AbortController === "function" ? new AbortController() : null;
    let timer;
    if (controller && requestTimeout > 0) {
      timer = globalThis.setTimeout(() => controller.abort(), requestTimeout);
    }

    try {
      const response = await fetchImplementation(`${root}${ruta.startsWith("/") ? ruta : `/${ruta}`}`, {
        method,
        headers: requestHeaders,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        ...(controller ? { signal: controller.signal } : {}),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 401) {
          try { onUnauthorized(); } catch { /* La respuesta 401 sigue siendo la causa original. */ }
        }
        throw new ApiError({
          status: response.status,
          mensaje: errorMessage(response.status, payload),
          codigo: errorCode(response.status),
        });
      }
      return payload;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError({
        status: 0,
        mensaje: "No hay conexión con el servidor. Intenta de nuevo.",
        codigo: "red",
      });
    } finally {
      if (timer !== undefined) globalThis.clearTimeout(timer);
    }
  }

  return { request };
}

export const apiClient = createApiClient({
  getToken: () => localStore.get(STORAGE_KEYS.authToken, null),
  onUnauthorized: () => {
    logout();
    if (typeof globalThis.CustomEvent === "function") {
      globalThis.dispatchEvent?.(new CustomEvent(DEMO_RESET_EVENT));
    }
  },
});