import { describe, expect, it } from "vitest";
import { createHealthService } from "../src/features/admin/healthService.js";

describe("health service Azure", () => {
  it("mapea disponibilidad, servicios y estado del asistente", async () => {
    const client = {
      request: async () => ({
        ok: true,
        servicios: { documentIntelligence: true, chat: false, language: true, speech: false },
        asistenteEncendido: true,
      }),
    };
    await expect(createHealthService({ client }).getHealth()).resolves.toEqual({
      disponible: true,
      servicios: { documentIntelligence: true, chat: false, language: true, speech: false },
      asistenteEncendido: true,
    });
  });

  it("devuelve disponible false si la API falla o la forma es inválida", async () => {
    await expect(createHealthService({ client: { request: async () => { throw new Error("offline"); } } }).getHealth())
      .resolves.toEqual({ disponible: false });
    await expect(createHealthService({ client: { request: async () => ({ servicios: {} }) } }).getHealth())
      .resolves.toEqual({ disponible: false });
  });
});
