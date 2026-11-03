import { describe, expect, it } from "vitest";
import { loadConfig } from "../api/src/lib/config.js";

const SECRET = "t".repeat(42);

describe("configuración de la API", () => {
  it("requiere TOKEN_SECRET de al menos 32 caracteres", () => {
    expect(() => loadConfig({})).toThrow("Configuración inválida: TOKEN_SECRET");
    expect(() => loadConfig({ TOKEN_SECRET: "corto" })).toThrow(
      "Configuración inválida: TOKEN_SECRET",
    );
  });

  it("deja apagados los servicios opcionales incompletos", () => {
    const config = loadConfig({ TOKEN_SECRET: SECRET });
    expect(config.docIntelligence.configurado).toBe(false);
    expect(config.chat.configurado).toBe(false);
    expect(config.language.configurado).toBe(false);
    expect(config.speech.configurado).toBe(false);
  });

  it("normaliza endpoints y admite apagar el asistente", () => {
    const config = loadConfig({
      TOKEN_SECRET: SECRET,
      ASSISTANT_ENABLED: "false",
      DOCINT_ENDPOINT: "https://example.test/",
      DOCINT_KEY: "clave",
    });
    expect(config.assistantEnabled).toBe(false);
    expect(config.docIntelligence).toMatchObject({
      endpoint: "https://example.test",
      configurado: true,
      apiVersion: "2024-11-30",
    });
    expect(config.chat.apiVersion).toBe("2024-10-21");
    expect(config.language.apiVersion).toBe("2023-04-01");
  });
});
