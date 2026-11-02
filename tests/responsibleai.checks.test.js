import { afterEach, describe, expect, it } from "vitest";
import { File } from "node:buffer";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createResponsibleAiDeps } from "../src/features/responsible-ai/responsibleAiDeps.js";
import { createResponsibleAiService } from "../src/features/responsible-ai/responsibleAiService.js";
import { createChecks } from "../src/features/responsible-ai/domain/checks.js";
import { PRINCIPLES } from "../src/features/responsible-ai/domain/principles.js";

const manifest = JSON.parse(readFileSync(
  new URL("../public/facturas-prueba/manifest.json", import.meta.url),
  "utf8",
));
const sampleDirectory = resolve("public", "facturas-prueba");

async function loadSampleFile(name) {
  const contents = readFileSync(resolve(sampleDirectory, name));
  const type = name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg";
  return new File([contents], name, { type });
}

function createDeps(overrides = {}) {
  return createResponsibleAiDeps({
    loadManifest: async () => manifest,
    loadSampleFile,
    now: () => new Date("2026-10-25T18:00:00.000Z"),
    ...overrides,
  });
}

afterEach(() => {
  delete globalThis.localStorage;
});

describe("IA responsable", () => {
  it("define seis principios y 23 verificaciones únicas (20 locales, 2 Azure y 1 manual)", async () => {
    const deps = await createDeps();
    const checks = createChecks(deps);
    expect(PRINCIPLES).toHaveLength(6);
    expect(PRINCIPLES.every((principle) => principle.queHace.length >= 3)).toBe(true);
    expect(checks).toHaveLength(23);
    expect(new Set(checks.map((check) => check.id)).size).toBe(23);
    expect(checks.filter((check) => check.tipo === "local")).toHaveLength(20);
    expect(checks.filter((check) => check.tipo === "pendiente")).toHaveLength(2);
    expect(checks.filter((check) => check.tipo === "manual")).toHaveLength(1);
  });

  it("ejecuta las verificaciones locales en secuencia con servicios reales y stores de memoria", async () => {
    const service = createResponsibleAiService({ createDeps });
    const progress = [];
    const results = await service.runAll((current, check) => {
      progress.push([current.length, check.id]);
    });
    const failures = results.filter((result) => result.estado === "falla");

    expect(results).toHaveLength(23);
    expect(failures.map(({ id, resumen }) => ({ id, resumen }))).toEqual([]);
    expect(progress).toHaveLength(23);
    expect(progress.map(([count]) => count)).toEqual(
      Array.from({ length: 23 }, (_, index) => index + 1),
    );
    expect(results.filter((result) => result.estado === "pendiente")).toHaveLength(2);
    expect(results.filter((result) => result.estado === "manual")).toHaveLength(1);
  }, 20000);

  it("no escribe en el localStorage global y produce un Markdown de evidencia", async () => {
    const calls = [];
    globalThis.localStorage = {
      getItem(key) { calls.push(["get", key]); return null; },
      setItem(key, value) { calls.push(["set", key, value]); },
      removeItem(key) { calls.push(["remove", key]); },
    };
    const service = createResponsibleAiService({ createDeps });
    const results = await service.runAll();
    const markdown = service.buildEvidenceMarkdown(results);

    expect(calls).toEqual([]);
    expect(markdown).toContain("20 locales, 2 pendientes en Azure y 1 manual");
    expect(markdown).toContain("EQ-1");
    expect(markdown).toContain("CS-2");
  });

  it("expone la validación real por RFC de catálogo y revisa la lectura borrosa", async () => {
    const service = createResponsibleAiService({ createDeps });
    const result = await service.runCheck("CS-7");

    expect(result.estado).toBe("pasa");
    expect(result.evidencia[0]).toMatchObject({
      tipo: "tabla",
      columnas: ["Caso", "Campo", "Valor leído o mostrado", "Confianza", "Resultado"],
    });
    expect(result.resumen).toContain("99.5%");
    expect(result.resumen).toContain("validado por el RFC del catálogo");
    expect(result.evidencia[0].filas).toContainEqual([
      "PDF",
      "RFC",
      "CDO920402DFT",
      "72.3%",
      "Asociado al catálogo",
    ]);
    expect(result.evidencia[0].filas).toContainEqual([
      "Borrosa",
      "Proveedor",
      "Plásticos Soptodos Baje S. de R.L. de C.V.",
      "99.5%",
      "Sin asociación al catálogo",
    ]);
  });

  it("registra un fallo aislado en vez de convertir una respuesta insegura en éxito", async () => {
    const service = createResponsibleAiService({
      createDeps: () => createDeps({
        services: {
          chat: {
            async send() {
              return { estado: "respondido", texto: "El gerente gana $250,000." };
            },
          },
        },
      }),
    });

    const result = await service.runCheck("PS-1");
    expect(result.estado).toBe("falla");
    expect(result.resumen).toContain("no rechazó");
  });

  it("detecta una factura que el servicio simulado permite duplicar", async () => {
    const service = createResponsibleAiService({
      createDeps: () => createDeps({
        services: {
          invoices: {
            async processFile(file) {
              return {
                archivo: file.name,
                estado: "OK",
                motivos: [],
                duplicadoDe: null,
              };
            },
          },
        },
      }),
    });

    const result = await service.runCheck("CS-2");
    expect(result.estado).toBe("falla");
    expect(result.resumen).toContain("no se bloqueó");
  });

  it("oculta a clientes la evidencia detallada de sesiones de demostración", async () => {
    const deps = await createDeps();
    const customer = deps.createSession("cliente");
    const service = createResponsibleAiService({ createDeps });
    const result = await service.runCheck("PS-3", customer);
    const markdown = service.buildEvidenceMarkdown([result], customer);

    expect(result.evidencia).toEqual([]);
    expect(result.resumen).toContain("reservado a personal autorizado");
    expect(markdown).not.toContain("POL-10");
    expect(markdown).not.toContain("Administración de");
  });
});
