import { describe, expect, it } from "vitest";
import { signToken, verifyToken } from "../api/src/lib/tokens.js";

const secret = "t".repeat(42);
const payload = {
  usuario: "laura",
  nombre: "Laura",
  rol: "finanzas",
  idSucursal: "gdl",
  idCliente: null,
};

describe("tokens de sesión", () => {
  it("firma y verifica un payload con tiempos inyectados", () => {
    const token = signToken(payload, secret, { now: 1000, ttlHours: 1 });
    expect(verifyToken(token, secret, { now: 1001 })).toMatchObject({
      ...payload,
      iat: 1000,
      exp: 3601000,
    });
  });

  it("rechaza firma, payload, formato y secreto alterados", () => {
    const token = signToken(payload, secret, { now: 1000 });
    const [encoded, signature] = token.split(".");
    const changedSignature = `${signature.slice(0, -1)}${signature.endsWith("A") ? "B" : "A"}`;
    const alteredPayload = Buffer.from(JSON.stringify({ ...payload, usuario: "otro", iat: 1000, exp: 28801000 }))
      .toString("base64url");
    for (const invalid of [
      `${encoded}.${changedSignature}`,
      `${encoded}.${signature}!`,
      `${alteredPayload}.${signature}`,
      "token-roto",
    ]) {
      expect(() => verifyToken(invalid, secret, { now: 1001 })).toThrow("Sesión inválida");
    }
    expect(() => verifyToken(token, `${secret}-distinto`, { now: 1001 }))
      .toThrow("Sesión inválida");
  });

  it("rechaza una sesión vencida", () => {
    const token = signToken(payload, secret, { now: 1000, ttlHours: 1 });
    expect(() => verifyToken(token, secret, { now: 3601001 })).toThrow("Sesión vencida");
  });
});
