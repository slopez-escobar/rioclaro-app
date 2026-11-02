import { File } from "node:buffer";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { proveedores as supplierCatalog } from "../src/data/source/proveedores-catalogo.json";
import { createInvoiceRepository } from "../src/features/invoices/invoiceRepository.js";
import { createInvoiceService } from "../src/features/invoices/invoiceService.js";
import { isLowConfidence } from "../src/features/invoices/domain/confidenceThresholds.js";
import { createRealReadingExtractor } from "../src/features/invoices/services/realReadings.js";
import { hashFile } from "../src/shared/utils/hashFile.js";

const finance = { usuario: "laura", nombre: "Laura Hernández", rol: "finanzas" };
const sampleDirectory = new URL("../public/facturas-prueba/", import.meta.url);

function sampleFile(name) {
  const contents = readFileSync(new URL(name, sampleDirectory));
  const type = name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg";
  return new File([contents], name, { type });
}

function createService(extractor) {
  const values = new Map();
  const repository = createInvoiceRepository({
    store: {
      get(key, fallback = null) { return values.has(key) ? values.get(key) : fallback; },
      set(key, value) { values.set(key, structuredClone(value)); return { ok: true }; },
      remove(key) { values.delete(key); },
    },
    seed: [],
  });
  return createInvoiceService({
    extractor,
    repository,
    proveedores: async () => supplierCatalog,
    hashFile,
    now: () => "2026-10-31T12:00:00.000Z",
  });
}

function realReadingExtractor() {
  return createRealReadingExtractor();
}

describe("lecturas reales de Document Intelligence", () => {
  it("acepta el PDF por RFC de catálogo aunque las confianzas de proveedor y RFC sean bajas", async () => {
    const extractor = realReadingExtractor();
    const file = sampleFile("FACTURA 8841 (1).pdf");
    const extraction = await extractor.extractInvoice(file);
    const service = createService(extractor);
    const invoice = await service.processFile(file, finance);
    const catalogSupplier = supplierCatalog.find((supplier) =>
      supplier.rfc === extraction.rfc.valor);

    expect(invoice.motivos).toEqual([]);
    expect(invoice.estado).toBe("OK");
    expect(extraction).toMatchObject({
      proveedor: { valor: "CY", confianza: 0.82 },
      rfc: { valor: "CDO920402DFT", confianza: 0.723 },
      folio: { valor: "A-8841", confianza: 0.798 },
      fecha: { valor: "2026-10-06", confianza: 0.983 },
      total: { valor: 10750.76, confianza: 0.982 },
    });
    expect(catalogSupplier).toBeDefined();
    expect(invoice.proveedor).toBe(catalogSupplier.razonSocial);
    expect(invoice.proveedorId).toBe(catalogSupplier.idProveedor);
    expect(invoice.folio).toBe("A-8841");
    expect(invoice.confianza.folio).toBe(0.798);
    expect(isLowConfidence("folio", invoice.confianza.folio)).toBe(false);
  });

  it("bloquea la foto posterior al PDF por datos aunque tenga hash distinto y folio de 0.683", async () => {
    const extractor = realReadingExtractor();
    const service = createService(extractor);
    const pdf = await service.processFile(sampleFile("FACTURA 8841 (1).pdf"), finance);
    const photo = await service.processFile(sampleFile("20261016_091523.jpg"), finance);

    expect(pdf.estado).toBe("OK");
    expect(photo).toMatchObject({
      estado: "Duplicada",
      duplicadoDe: { archivo: "FACTURA 8841 (1).pdf", tipo: "datos" },
      proveedor: pdf.proveedor,
      rfc: "CDO920402DFT",
      confianza: { proveedor: 0.738, rfc: 0.821, folio: 0.683, fecha: 0.979, total: 0.976 },
    });
    expect(photo.hash).not.toBe(pdf.hash);
    expect(isLowConfidence("folio", photo.confianza.folio)).toBe(false);
  });

  it("revisa el nombre de proveedor mal leído al 99.5% sin RFC ni asociación al catálogo", async () => {
    const service = createService(realReadingExtractor());
    const invoice = await service.processFile(sampleFile("factura_urgente.jpg"), finance);

    expect(invoice).toMatchObject({
      estado: "Revisar",
      proveedor: "Plásticos Soptodos Baje S. de R.L. de C.V.",
      confianza: { proveedor: 0.995 },
      proveedorId: null,
    });
    expect(invoice.motivos).toEqual(expect.arrayContaining([
      "Falta el RFC",
      "Falta el folio",
      "Falta la fecha",
      "Falta el total",
    ]));
  });

  it("manda a revisión un total con confianza de 0.85", async () => {
    const baseExtractor = realReadingExtractor();
    const service = createService({
      async extractInvoice(file) {
        const extraction = await baseExtractor.extractInvoice(file);
        return { ...extraction, total: { ...extraction.total, confianza: 0.85 } };
      },
    });
    const invoice = await service.processFile(sampleFile("FACTURA 8841 (1).pdf"), finance);

    expect(invoice.estado).toBe("Revisar");
    expect(invoice.motivos).toContain("Confianza baja en total: 85%");
  });
});
