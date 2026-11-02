import { fail } from "./http.js";
import { can } from "./permissions.js";
import { verifyToken } from "./tokens.js";

export function requireSession(request, { config, now, roles: requiredPermissions = [] }) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = request.headers.get("x-rc-token")
    ?? (authorization.toLowerCase().startsWith("bearer ")
      ? authorization.slice(7).trim()
      : authorization.trim());

  if (!token) return fail(401, "Sesión inválida");

  let session;
  try {
    session = verifyToken(token, config.tokenSecret, { now });
  } catch {
    return fail(401, "Sesión inválida");
  }

  if (
    requiredPermissions.some(({ modulo, accion }) => !can(session.rol, modulo, accion))
  ) {
    return fail(403, "Tu rol no tiene acceso a este servicio");
  }
  return session;
}
