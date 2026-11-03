import { describe, expect, it } from "vitest";
import { createLoginHandler } from "../api/src/handlers/login.js";
import { createHealthHandler } from "../api/src/handlers/health.js";
import { requireSession } from "../api/src/lib/auth.js";
import { errorToResponse, parseJsonBody } from "../api/src/lib/http.js";
import { loadConfig } from "../api/src/lib/config.js";
import { signToken, verifyToken } from "../api/src/lib/tokens.js";
import { usuarios } from "../api/data/usuarios.json";
import { roles } from "../api/data/roles.json";
import { login as appLogin } from "../src/features/auth/authService.local.js";

const TOKEN_SECRET = "t".repeat(42);
const config = {
  tokenSecret: TOKEN_SECRET,
  tokenTtlHours: 8,
  assistantEnabled: true,
  docIntelligence: { configurado: true },
  chat: { configurado: false },
  language: { configurado: true },
  speech: { configurado: false },
};

function request(body, headers = {}) {
  return {
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    json: async () => body,
    query: { get: () => null },
    method: "POST",
    url: "http://localhost/api/login",
  };
}

describe("handler de login", () => {
  it("acepta las seis cuentas de demostración y genera la sesión de la app", async () => {
    const now = 1000;
    const handler = createLoginHandler({ config, now: () => now });
    for (const username of ["ernesto", "laura", "mariana", "tono", "carlos", "cliente1"]) {
      const response = await handler(request(
        { usuario: username, password: "demo123" },
        { "x-forwarded-for": `192.0.2.${username.length}` },
      ));
      expect(response.status).toBe(200);
      expect(Object.keys(response.jsonBody.sesion)).toEqual([
        "usuario", "nombre", "rol", "esEmpleado", "puesto", "idEmpleado",
        "idCliente", "idSucursal", "alcance", "expiraEn",
      ]);
      const verified = verifyToken(response.jsonBody.token, TOKEN_SECRET, { now });
      expect(verified).toMatchObject({
        usuario: response.jsonBody.sesion.usuario,
        nombre: response.jsonBody.sesion.nombre,
        rol: response.jsonBody.sesion.rol,
        idSucursal: response.jsonBody.sesion.idSucursal,
        idCliente: response.jsonBody.sesion.idCliente,
        exp: response.jsonBody.sesion.expiraEn,
      });
      expect(JSON.stringify(response.jsonBody)).not.toMatch(/password|demo123/i);
    }

    const appSession = appLogin("laura", "demo123", {
      get: () => null,
      set: () => {},
      remove: () => {},
    }).session;
    const apiSession = (await handler(request(
      { usuario: "laura", password: "demo123" },
      { "x-forwarded-for": "192.0.2.100" },
    ))).jsonBody.sesion;
    expect(Object.keys(apiSession)).toEqual(Object.keys(appSession));
  });

  it("responde igual a credenciales incorrectas y usuario desconocido, y limita el intento 11", async () => {
    let now = 1000;
    const handler = createLoginHandler({ config, now: () => now });
    const badPassword = await handler(request(
      { usuario: "laura", password: "incorrecta" },
      { "x-forwarded-for": "192.0.2.1" },
    ));
    const missingUser = await handler(request(
      { usuario: "inexistente", password: "incorrecta" },
      { "x-forwarded-for": "192.0.2.2" },
    ));
    expect(badPassword).toEqual(missingUser);
    expect(badPassword).toMatchObject({
      status: 401,
      jsonBody: { error: "Usuario o contraseña incorrectos." },
    });

    const limitedHandler = createLoginHandler({ config, now: () => now });
    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect((await limitedHandler(request(
        { usuario: "laura", password: "incorrecta" },
        { "x-forwarded-for": "192.0.2.3" },
      ))).status).toBe(401);
    }
    expect(await limitedHandler(request(
      { usuario: "laura", password: "incorrecta" },
      { "x-forwarded-for": "192.0.2.3" },
    ))).toMatchObject({
      status: 429,
      headers: { "retry-after": expect.any(String) },
      jsonBody: { error: "Demasiados intentos. Espera unos minutos." },
    });
    expect(await limitedHandler(request(
      { usuario: "laura", password: "demo123" },
      { "x-forwarded-for": "192.0.2.3" },
    ))).toMatchObject({ status: 429 });
    now += 15 * 60 * 1000 + 1;
  });

  it("incluye los 150 usuarios y todos sus roles están definidos", () => {
    const roleCodes = new Set(roles.map((role) => role.codigo));
    expect(usuarios).toHaveLength(150);
    expect(usuarios.every((user) => roleCodes.has(user.rol))).toBe(true);
  });
});

describe("autorización de sesión", () => {
  const session = {
    usuario: "laura",
    nombre: "Laura",
    rol: "finanzas",
    idSucursal: "gdl",
    idCliente: null,
  };
  const now = 1000;
  const validToken = signToken(session, TOKEN_SECRET, { now });

  it("rechaza token faltante, alterado y vencido", () => {
    const options = { config: { tokenSecret: TOKEN_SECRET }, now };
    expect(requireSession(request({}, {}), options)).toMatchObject({ status: 401 });
    expect(requireSession(request({}, { authorization: `Bearer ${validToken}x` }), options))
      .toMatchObject({ status: 401 });
    const expired = signToken(session, TOKEN_SECRET, { now: 0, ttlHours: 0.0001 });
    expect(requireSession(request({}, { "x-rc-token": expired }), {
      config: { tokenSecret: TOKEN_SECRET },
      now: 1000,
    })).toMatchObject({ status: 401 });
  });

  it("aplica permisos requeridos y acepta x-rc-token", () => {
    const options = {
      config: { tokenSecret: TOKEN_SECRET },
      now,
      roles: [{ modulo: "nominas", accion: "ver" }],
    };
    expect(requireSession(request({}, { authorization: `Bearer ${validToken}` }), options))
      .toMatchObject({ status: 403, jsonBody: { error: "Tu rol no tiene acceso a este servicio" } });
    expect(requireSession(request({}, { "x-rc-token": validToken }), {
      ...options,
      roles: [{ modulo: "facturas_proveedores", accion: "ver" }],
    })).toMatchObject(session);
  });
});

describe("handler de salud", () => {
  it("expone banderas de configuración, sin filtrar valores sensibles", async () => {
    const configured = loadConfig({
      TOKEN_SECRET,
      DOCINT_ENDPOINT: "https://doc-secret.test",
      DOCINT_KEY: "clave-doc",
      AOAI_ENDPOINT: "https://chat-secret.test",
      AOAI_KEY: "clave-chat",
      AOAI_DEPLOYMENT: "despliegue-secreto",
      LANGUAGE_ENDPOINT: "https://language-secret.test",
      LANGUAGE_KEY: "clave-language",
      SPEECH_REGION: "region-secreta",
      SPEECH_KEY: "clave-speech",
    });
    const health = createHealthHandler({ config: configured, now: () => 0 });
    const response = await health();
    expect(response.jsonBody).toEqual({
      ok: true,
      version: "1.0.0",
      servicios: {
        documentIntelligence: true,
        chat: true,
        language: true,
        speech: true,
      },
      asistenteEncendido: true,
      hora: "1970-01-01T00:00:00.000Z",
    });
    for (const secret of [
      TOKEN_SECRET,
      "clave-doc",
      "https://doc-secret.test",
      "clave-chat",
      "despliegue-secreto",
      "clave-language",
      "region-secreta",
      "clave-speech",
    ]) {
      expect(JSON.stringify(response)).not.toContain(secret);
    }
  });
});

describe("respuestas HTTP auxiliares", () => {
  it("rechaza JSON inválido y cuerpos que exceden el límite", async () => {
    expect(await parseJsonBody({ json: async () => { throw new Error("detalle"); } }))
      .toMatchObject({ response: { status: 400, jsonBody: { error: "Solicitud inválida" } } });
    expect(await parseJsonBody({ json: async () => ({ value: "demasiado largo" }) }, {
      maxBytes: 4,
    })).toMatchObject({
      response: {
        status: 413,
        jsonBody: { error: "El archivo supera el tamaño permitido" },
      },
    });
  });

  it("oculta detalles de errores inesperados", () => {
    expect(errorToResponse(new Error("secreto"))).toEqual({
      status: 500,
      jsonBody: { error: "Error interno" },
    });
  });
});
