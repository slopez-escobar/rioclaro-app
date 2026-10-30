import { File } from "node:buffer";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createAzureExtractor } from "../src/features/invoices/services/extractor.azure.js";
import { createMockExtractor } from "../src/features/invoices/services/extractor.mock.js";

const manifest = JSON.parse(
  readFileSync(new URL("../public/facturas-prueba/manifest.json", import.meta.url), "utf8"),
);
const invoiceDirectory = new URL("../public/facturas-prueba/", import.meta.url);

function loadFixture(invoice) {
  const contents = readFileSync(new URL(invoice.archivo, invoiceDirectory));
  return new File([contents], invoice.archivo, { type: invoice.formato });
}

function loadManifest() {
  return Promise.resolve(manifest);
}

describe("extractor simulado", () => {
  it.each(manifest.facturas)(
    "extrae los datos esperados de $archivo",
    async (invoice) => {
      const file = loadFixture(invoice);
      const extractor = createMockExtractor({ loadManifest, delayMs: 0 });
      const result = await extractor.extractInvoice(file);
      const unreadableTotal = invoice.esperado.totalLegible === false;
      const confidence = unreadableTotal
        ? 0.9
        : invoice.formato === "pdf"
          ? 0.98
          : 0.93;

      expect(result.proveedor).toEqual({
        valor: invoice.esperado.proveedor,
        confianza: confidence,
      });
      expect(result.rfc).toEqual({ valor: invoice.esperado.rfc, confianza: confidence });
      expect(result.folio).toEqual({ valor: invoice.esperado.folio, confianza: confidence });
      expect(result.fecha).toEqual({ valor: invoice.esperado.fecha, confianza: confidence });
      expect(result.total).toEqual({
        valor: unreadableTotal ? null : invoice.esperado.total,
        confianza: unreadableTotal ? 0.41 : confidence,
      });
      expect(result.meta).toMatchObject({
        origen: "simulado",
        archivo: invoice.archivo,
      });
      expect(result.meta.hash).toBe(invoice.sha256);
      expect(result.meta.tiempoMs).toEqual(expect.any(Number));
      expect(result.meta).not.toHaveProperty("motivo");
    },
  );

  it("devuelve total ilegible para factura_urgente.jpg", async () => {
    const invoice = manifest.facturas.find((entry) => entry.archivo === "factura_urgente.jpg");
    const result = await createMockExtractor({ loadManifest, delayMs: 0 })
      .extractInvoice(loadFixture(invoice));

    expect(result.total).toEqual({ valor: null, confianza: 0.41 });
    expect(result.proveedor.confianza).toBe(0.9);
    expect(result.rfc.confianza).toBe(0.9);
    expect(result.folio.confianza).toBe(0.9);
    expect(result.fecha.confianza).toBe(0.9);
  });

  it("devuelve campos vacíos y motivo para un archivo desconocido", async () => {
    const unknownFile = new File(["contenido desconocido"], "no-reconocido.pdf");
    const result = await createMockExtractor({ loadManifest, delayMs: 0 })
      .extractInvoice(unknownFile);

    for (const field of ["proveedor", "rfc", "folio", "fecha", "total"]) {
      expect(result[field]).toEqual({ valor: null, confianza: 0 });
    }
    expect(result.meta).toMatchObject({
      origen: "simulado",
      archivo: "no-reconocido.pdf",
      motivo: "Archivo no reconocido por el simulador",
    });
  });

  it("busca por nombre exacto cuando el hash no coincide", async () => {
    const invoice = manifest.facturas[0];
    const original = loadFixture(invoice);
    const modifiedFile = new File(["contenido modificado"], invoice.archivo);
    expect(modifiedFile.name).toBe(original.name);

    const result = await createMockExtractor({ loadManifest, delayMs: 0 })
      .extractInvoice(modifiedFile);

    expect(result.proveedor.valor).toBe(invoice.esperado.proveedor);
    expect(result.meta.hash).not.toBe(invoice.sha256);
  });

  it("carga el manifiesto una sola vez por instancia", async () => {
    const loader = vi.fn(loadManifest);
    const extractor = createMockExtractor({ loadManifest: loader, delayMs: 0 });

    await extractor.extractInvoice(loadFixture(manifest.facturas[0]));
    await extractor.extractInvoice(loadFixture(manifest.facturas[1]));

    expect(loader).toHaveBeenCalledTimes(1);
  });
});

describe("extractor de Azure", () => {
  it("indica que aún no está implementado el paso B3", async () => {
    const extractor = createAzureExtractor();
    await expect(extractor.extractInvoice(new File([], "factura.pdf"))).rejects.toThrow(
      "Extractor de Azure no implementado (paso B3)",
    );
  });
});
