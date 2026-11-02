import { File } from "node:buffer";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { WEEKLY_MANUAL_HOURS_BASELINE } from "../src/config/constants.js";
import { proveedores as supplierCatalog } from "../src/data/source/proveedores-catalogo.json";
import { createInvoiceRepository } from "../src/features/invoices/invoiceRepository.js";
import { createInvoiceService } from "../src/features/invoices/invoiceService.js";
import { estimateHumanMinutes } from "../src/features/invoices/domain/estimateHumanMinutes.js";
import { pendingApprovals } from "../src/features/invoices/domain/invoiceDecisions.js";
import { createMockExtractor } from "../src/features/invoices/services/extractor.mock.js";
import { createAzureExtractor } from "../src/features/invoices/services/extractor.azure.js";
import { createApiClient } from "../src/shared/api/apiClient.js";
import { hashFile } from "../src/shared/utils/hashFile.js";

const manifest = JSON.parse(
  readFileSync(new URL("../public/facturas-prueba/manifest.json", import.meta.url), "utf8"),
);
const fixtureDirectory = new URL("../public/facturas-prueba/", import.meta.url);
const finance = { usuario: "laura", nombre: "Laura Hernández", rol: "finanzas" };
const director = { usuario: "ernesto", nombre: "Ernesto Garibay", rol: "direccion" };
const purchasing = { usuario: "yesenia", nombre: "Yesenia Flores", rol: "compras" };

function createMemoryStore() {
  const values = new Map();
  return {
    get(key, fallback = null) {
      return values.has(key) ? values.get(key) : fallback;
    },
    set(key, value) {
      values.set(key, structuredClone(value));
      return { ok: true };
    },
    remove(key) {
      values.delete(key);
    },
  };
}

function makeService({ seed = [], extractorOverride, now = () => "2026-10-27T16:00:00.000Z" } = {}) {
  const repository = createInvoiceRepository({ store: createMemoryStore(), seed });
  const mockExtractor = createMockExtractor({
    loadManifest: () => Promise.resolve(manifest),
    delayMs: 0,
  });
  return {
    repository,
    service: createInvoiceService({
      extractor: extractorOverride ?? mockExtractor,
      repository,
      proveedores: () => Promise.resolve(supplierCatalog),
      hashFile,
      now,
    }),
  };
}

function fixture(invoice) {
  const buffer = readFileSync(new URL(invoice.archivo, fixtureDirectory));
  return new File([buffer], invoice.archivo, { type: invoice.formato });
}

function response(data, contentType = "") {
  return {
    ok: true,
    status: 200,
    async json() {
      return data;
    },
    async blob() {
      return new Blob([data], { type: contentType });
    },
  };
}

describe("servicio de aplicación de facturas", () => {
  it("procesa secuencialmente las 11 facturas y conserva estados y duplicados del manifiesto", async () => {
    const { service, repository } = makeService();
    const files = manifest.facturas.map(fixture);
    const progress = [];
    const result = await service.processFiles(files, finance, (item) => progress.push(item));

    expect(result.errores).toEqual([]);
    expect(result.creados.map((record) => record.estado))
      .toEqual(manifest.facturas.map((invoice) => invoice.estadoEsperado));
    expect(result.creados).toHaveLength(11);
    expect(new Set(result.creados.map((record) => record.id)).size).toBe(11);
    expect(result.creados.map((record) => record.id)).toEqual(
      Array.from({ length: 11 }, (_, index) => `FAC-${String(index + 1).padStart(4, "0")}`),
    );
    expect(progress.map((item) => item.archivo)).toEqual(
      manifest.facturas.map((invoice) => invoice.archivo),
    );
    expect(progress.map((item) => item.actual)).toEqual(
      Array.from({ length: 11 }, (_, index) => index + 1),
    );

    const photo = result.creados.find((record) => record.archivo === "20261016_091523.jpg");
    expect(photo).toMatchObject({
      estado: "Duplicada",
      duplicadoDe: { archivo: "FACTURA 8841 (1).pdf", tipo: "datos" },
    });
    const hashDuplicate = result.creados.find(
      (record) => record.archivo === "factura_final2 - copia.pdf",
    );
    expect(hashDuplicate.duplicadoDe.tipo).toBe("hash");
    expect(repository.list()).toHaveLength(11);
  });

  it.each([
    ["ventas", { ...finance, rol: "ventas" }, false],
    ["compras", purchasing, true],
    ["dirección", director, false],
    ["Finanzas", finance, true],
  ])("valida permiso de subida para %s", async (_role, session, allowed) => {
    const { service } = makeService();
    const file = fixture(manifest.facturas[0]);
    if (allowed) {
      await expect(service.processFile(file, session)).resolves.toMatchObject({
        archivo: file.name,
      });
    } else {
      await expect(service.processFile(file, session)).rejects.toThrow(
        "No tienes permiso para subir facturas",
      );
    }
  });

  it("rechaza formato no admitido y archivos mayores de 10 MB", async () => {
    const { service } = makeService();
    const unsupported = new File(["contenido"], "factura.txt");
    const tooLarge = {
      name: "factura.pdf",
      size: 10 * 1024 * 1024 + 1,
      async arrayBuffer() {
        return new ArrayBuffer(0);
      },
    };

    await expect(service.processFile(unsupported, finance)).rejects.toThrow(
      "Formato no admitido (usa PDF, JPG o PNG)",
    );
    await expect(service.processFile(tooLarge, finance)).rejects.toThrow(
      "El archivo supera 10 MB",
    );
  });

  it("continúa el lote cuando un archivo falla y notifica el progreso de cada uno", async () => {
    const { service } = makeService();
    const valid = fixture(manifest.facturas[0]);
    const invalid = new File(["dato"], "invalido.txt");
    const progress = [];
    const result = await service.processFiles([valid, invalid], finance, (item) => {
      progress.push(item);
    });

    expect(result.creados).toHaveLength(1);
    expect(result.errores).toEqual([{
      archivo: "invalido.txt",
      error: "Formato no admitido (usa PDF, JPG o PNG)",
    }]);
    expect(progress).toEqual([
      {
        actual: 1,
        total: 2,
        archivo: valid.name,
        estado: "OK",
        error: null,
      },
      {
        actual: 2,
        total: 2,
        archivo: invalid.name,
        estado: null,
        error: "Formato no admitido (usa PDF, JPG o PNG)",
      },
    ]);
  });

  it("marca Revisar y agrega el motivo cuando el extractor falla", async () => {
    const { service } = makeService({
      extractorOverride: {
        async extractInvoice() {
          throw new Error("Extractor fuera de línea");
        },
      },
    });
    const record = await service.processFile(fixture(manifest.facturas[0]), finance);

    expect(record.estado).toBe("Revisar");
    expect(record.motivos).toContain("No se pudo leer automáticamente");
    expect(record.proveedor).toBeNull();
    expect(record.rfc).toBeNull();
    expect(record.folio).toBeNull();
    expect(record.fecha).toBeNull();
    expect(record.total).toBeNull();
    expect(record.nombreEstandar).toBeNull();
  });

  it("deja en Revisar una factura cuando falla la conexión de Azure", async () => {
    const client = createApiClient({ fetch: async () => { throw new Error("offline"); } });
    const { service } = makeService({ extractorOverride: createAzureExtractor({ client }) });
    const record = await service.processFile(fixture(manifest.facturas[0]), finance);

    expect(record.estado).toBe("Revisar");
    expect(record.motivos).toContain("No se pudo leer automáticamente");
  });

  it("decide una factura de alto importe en ambos órdenes de aprobación", async () => {
    const highValueInvoice = {
      id: "FAC-0090",
      archivo: "alto.pdf",
      subidaEn: "2026-10-26T10:00:00Z",
      estado: "OK",
      total: 100000.01,
      requiereDireccion: true,
      motivos: [],
      aprobaciones: [],
      historial: [],
      decididaPor: null,
      decididaEn: null,
    };
    const first = makeService({ seed: [highValueInvoice] });
    const pending = first.service.decide("FAC-0090", { accion: "aprobar" }, finance);
    expect(pending.estado).toBe("OK");
    expect(pending.aprobaciones).toHaveLength(1);
    const approved = first.service.decide("FAC-0090", { accion: "aprobar" }, director);
    expect(approved.estado).toBe("Aprobada");
    expect(approved.decididaPor).toBe("ernesto");

    const reverse = makeService({ seed: [highValueInvoice] });
    expect(reverse.service.decide("FAC-0090", { accion: "aprobar" }, director).estado).toBe("OK");
    expect(
      reverse.service.decide("FAC-0090", { accion: "aprobar" }, finance).estado,
    ).toBe("Aprobada");
  });

  it("exige comentario para decidir una factura en revisión", async () => {
    const reviewInvoice = {
      id: "FAC-0010",
      archivo: "revision.pdf",
      subidaEn: "2026-10-26T10:00:00Z",
      estado: "Revisar",
      total: 1000,
      motivos: ["Requiere revisión"],
      aprobaciones: [],
      historial: [],
    };
    const { service } = makeService({ seed: [reviewInvoice] });

    expect(() =>
      service.decide("FAC-0010", { accion: "aprobar" }, finance),
    ).toThrow("El comentario es obligatorio (mínimo 5 caracteres)");
    const approved = service.decide(
      "FAC-0010",
      { accion: "aprobar", comentario: "Revisada" },
      finance,
    );
    expect(approved.estado).toBe("Aprobada");
  });

  it("no aprueba duplicadas, pero permite liberarlas o rechazarlas", () => {
    const duplicateInvoice = {
      id: "FAC-0020",
      archivo: "duplicada.pdf",
      subidaEn: "2026-10-26T10:00:00Z",
      estado: "Duplicada",
      total: 500,
      motivos: ["Duplicada por datos"],
      duplicadoDe: { id: "FAC-0019", archivo: "original.pdf", tipo: "datos" },
      aprobaciones: [],
      historial: [],
    };
    const { service } = makeService({ seed: [duplicateInvoice] });
    expect(() =>
      service.decide("FAC-0020", { accion: "aprobar" }, finance),
    ).toThrow("Una factura duplicada debe liberarse antes de aprobarla");

    expect(
      service.decide(
        "FAC-0020",
        { accion: "liberar", comentario: "El proveedor confirmó el documento" },
        finance,
      ).estado,
    ).toBe("Revisar");

    const other = makeService({ seed: [duplicateInvoice] });
    expect(
      other.service.decide(
        "FAC-0020",
        { accion: "rechazar", comentario: "Confirmada como duplicada" },
        finance,
      ).estado,
    ).toBe("Rechazada");
  });

  it("resume conteos, pendientes de Dirección y tiempo humano estimado", async () => {
    const { service, repository } = makeService();
    await service.processFiles(manifest.facturas.map(fixture), finance);
    const summary = service.summary();

    expect(summary.porEstado).toEqual({
      OK: 6,
      Revisar: 3,
      Duplicada: 2,
      Aprobada: 0,
      Rechazada: 0,
    });
    const expectedMinutes = estimateHumanMinutes(
      manifest.facturas.map((invoice, index) => ({
        estado: invoice.estadoEsperado,
        id: `FAC-${String(index + 1).padStart(4, "0")}`,
      })),
    );
    expect(summary.minutosHumanosEstimados).toBe(expectedMinutes.minutos);
    expect(summary.horasHumanasEstimadas).toBe(expectedMinutes.horas);
    expect(summary.horasLineaBase).toBe(WEEKLY_MANUAL_HOURS_BASELINE);
    expect(summary.pendientesDeDireccion).toBe(
      repository.list().filter(
        (invoice) =>
          !["Aprobada", "Rechazada"].includes(invoice.estado)
          && pendingApprovals(invoice).includes("direccion"),
      ).length,
    );
    expect(summary.porcentajeReduccion).toBe(
      ((WEEKLY_MANUAL_HOURS_BASELINE - expectedMinutes.horas)
        / WEEKLY_MANUAL_HOURS_BASELINE) * 100,
    );
  });

  it("carga y procesa los archivos de muestra por el orden del manifiesto", async () => {
    const { repository } = makeService();
    const fetchSample = vi.fn(async (url) => {
      if (url.endsWith("manifest.json")) return response(manifest);
      const encodedName = url.split("/").pop();
      const filename = decodeURIComponent(encodedName);
      const invoice = manifest.facturas.find((entry) => entry.archivo === filename);
      return response(
        readFileSync(new URL(invoice.archivo, fixtureDirectory)),
        sampleContentType(invoice.formato),
      );
    });
    const serviceWithSamples = createInvoiceService({
      extractor: createMockExtractor({
        loadManifest: () => Promise.resolve(manifest),
        delayMs: 0,
      }),
      repository,
      proveedores: () => Promise.resolve(supplierCatalog),
      hashFile,
      now: () => "2026-10-27T16:00:00.000Z",
      fetchSample,
    });
    const progress = [];
    const result = await serviceWithSamples.loadSampleInvoices(finance, (item) => {
      progress.push(item.archivo);
    });

    expect(result.errores).toEqual([]);
    expect(result.creados.map((record) => record.archivo)).toEqual(
      manifest.facturas.map((invoice) => invoice.archivo),
    );
    expect(progress).toEqual(manifest.facturas.map((invoice) => invoice.archivo));
    expect(fetchSample).toHaveBeenCalledTimes(manifest.facturas.length + 1);
  });
});

function sampleContentType(format) {
  if (format === "pdf") return "application/pdf";
  if (format === "png") return "image/png";
  return "image/jpeg";
}
