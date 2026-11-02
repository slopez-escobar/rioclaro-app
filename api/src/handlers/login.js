import { readFileSync } from "node:fs";
import { timingSafeEqual, createHash } from "node:crypto";
import { errorToResponse, fail, parseJsonBody } from "../lib/http.js";
import { signToken } from "../lib/tokens.js";
import { createRateLimiter } from "../lib/rateLimit.js";

const userData = JSON.parse(
  readFileSync(new URL("../../data/usuarios.json", import.meta.url), "utf8"),
);
const defaultRoles = JSON.parse(
  readFileSync(new URL("../../data/roles.json", import.meta.url), "utf8"),
).roles;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function timeValue(now) {
  return typeof now === "function" ? now() : now ?? Date.now();
}

function safePasswordEqual(actual, expected) {
  const actualHash = createHash("sha256").update(String(actual)).digest();
  const expectedHash = createHash("sha256").update(String(expected)).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

function sessionFrom(user, roles, expiresAt) {
  const role = roles.find((item) => item.codigo === user.rol);
  return {
    usuario: user.usuario,
    nombre: user.nombre,
    rol: user.rol,
    esEmpleado: Boolean(role?.esEmpleado),
    puesto: user.puesto || null,
    idEmpleado: user.idEmpleado || null,
    idCliente: user.idCliente || null,
    idSucursal: user.idSucursal,
    alcance: role?.alcance ?? null,
    expiraEn: expiresAt,
  };
}

export function createLoginHandler({
  config,
  now = Date.now,
  rateLimiter = createRateLimiter({ now: () => timeValue(now) }),
  users = userData.usuarios,
  roles = defaultRoles,
} = {}) {
  return async function loginHandler(request) {
    try {
      const parsed = await parseJsonBody(request, { maxBytes: 16 * 1024 });
      if (parsed.response) return parsed.response;

      const username = typeof parsed.body.usuario === "string"
        ? parsed.body.usuario.trim().toLowerCase()
        : "";
      const password = typeof parsed.body.password === "string" ? parsed.body.password : "";
      const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
      const ip = forwardedFor.split(",")[0].trim() || "desconocida";
      const userKey = `usuario:${username || "desconocido"}`;
      const ipKey = `ip:${ip}`;
      const limitOptions = { max: MAX_ATTEMPTS, ventanaMs: WINDOW_MS };
      const userLimit = rateLimiter.peek(userKey, limitOptions);
      const ipLimit = rateLimiter.peek(ipKey, limitOptions);
      if (!userLimit.permitido || !ipLimit.permitido) {
        const retryAfter = Math.max(
          userLimit.reintentarEnSegundos,
          ipLimit.reintentarEnSegundos,
        );
        return {
          ...fail(429, "Demasiados intentos. Espera unos minutos."),
          headers: { "retry-after": String(retryAfter) },
        };
      }

      const user = users.find((item) => item.usuario.toLowerCase() === username);
      const validPassword = user ? safePasswordEqual(password, user.password) : false;

      if (!user || !validPassword || !username) {
        rateLimiter.check(userKey, limitOptions);
        rateLimiter.check(ipKey, limitOptions);
        return fail(401, "Usuario o contraseña incorrectos.");
      }

      const issuedAt = timeValue(now);
      const expiresAt = issuedAt + config.tokenTtlHours * 60 * 60 * 1000;
      const sesion = sessionFrom(user, roles, expiresAt);
      const token = signToken({
        usuario: sesion.usuario,
        nombre: sesion.nombre,
        rol: sesion.rol,
        idSucursal: sesion.idSucursal,
        idCliente: sesion.idCliente,
      }, config.tokenSecret, { now: () => issuedAt, ttlHours: config.tokenTtlHours });
      return { status: 200, jsonBody: { token, sesion } };
    } catch (error) {
      return errorToResponse(error);
    }
  };
}
