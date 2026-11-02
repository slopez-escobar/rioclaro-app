import { createHmac, timingSafeEqual } from "node:crypto";

function currentTime(now) {
  return typeof now === "function" ? now() : now ?? Date.now();
}

function invalidSession() {
  return new Error("Sesión inválida");
}

export function signToken(payload, secret, { now, ttlHours = 8 } = {}) {
  const issuedAt = currentTime(now);
  const tokenPayload = {
    ...payload,
    iat: issuedAt,
    exp: issuedAt + ttlHours * 60 * 60 * 1000,
  };
  const encodedPayload = Buffer.from(JSON.stringify(tokenPayload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

export function verifyToken(token, secret, { now } = {}) {
  if (typeof token !== "string") throw invalidSession();
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw invalidSession();
  if (
    !/^[A-Za-z0-9_-]+$/.test(parts[0])
    || !/^[A-Za-z0-9_-]+$/.test(parts[1])
  ) {
    throw invalidSession();
  }

  let actualSignature;
  try {
    actualSignature = Buffer.from(parts[1], "base64url");
    if (
      actualSignature.toString("base64url") !== parts[1]
      || Buffer.from(parts[0], "base64url").toString("base64url") !== parts[0]
    ) {
      throw invalidSession();
    }
  } catch {
    throw invalidSession();
  }
  const expectedSignature = createHmac("sha256", secret).update(parts[0]).digest();
  if (
    actualSignature.length !== expectedSignature.length
    || !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    throw invalidSession();
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch {
    throw invalidSession();
  }
  if (
    !payload
    || typeof payload !== "object"
    || !Number.isFinite(payload.iat)
    || !Number.isFinite(payload.exp)
    || typeof payload.usuario !== "string"
    || typeof payload.nombre !== "string"
    || typeof payload.rol !== "string"
    || typeof payload.idSucursal !== "string"
    || !("idCliente" in payload)
    || (payload.idCliente !== null && typeof payload.idCliente !== "string")
  ) {
    throw invalidSession();
  }
  if (currentTime(now) > payload.exp) throw new Error("Sesión vencida");
  return payload;
}
