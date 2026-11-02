import { File } from "node:buffer";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createAzureExtractor } from "../src/features/invoices/services/extractor.azure.js";

const fixtureUrl = new URL("../public/facturas-prueba/FACTURA 8841 (1).pdf", import.meta.url);
const fixtureBytes = readFileSync(fixtureUrl);
const successResponse = {
  proveedor: { valor: "CY", confianza: 0.9 },
  rfc: { valor: "CDO920402DFT", confianza: 0.8 },
  folio: { valor: "A-8841", confianza: 0.7 },
  fecha: { valor: "2026-10-06", confianza: 0.95 },
  total: { valor: 10750.76, confianza: 0.98 },
  meta: { origen: "azure-document-intelligence", tiempoMs: 42 },
};

describe("extractor Azure", () => {
  it("manda base64 del archivo real sin prefijo y conserva el origen", async () => {
    const file = new File([fixtureBytes], "FACTURA 8841 (1).pdf", { type: "application/pdf" });
    const client = { request: vi.fn().mockResolvedValue(successResponse) };
    const result = await createAzureExtractor({ client }).extractInvoice(file);
    const [{ body }] = client.request.mock.calls[0].slice(1);

    expect(body.base64).toBe(Buffer.from(fixtureBytes).toString("base64"));
    expect(body.base64).not.toMatch(/^data:/);
    expect(body).toMatchObject({ nombre: file.name, tipo: file.type });
    expect(result).toEqual(successResponse);
  });

  it("rechaza respuestas incompletas con el mensaje exacto", async () => {
    const client = { request: async () => ({ ...successResponse, total: undefined }) };
    const file = new File([fixtureBytes], "factura.pdf", { type: "application/pdf" });
    await expect(createAzureExtractor({ client }).extractInvoice(file))
      .rejects.toThrow("Respuesta inesperada del servicio de lectura de facturas.");
  });

  it("valida extensión y tamaño antes de llamar a la API", async () => {
    const client = { request: vi.fn() };
    const extractor = createAzureExtractor({ client });
    await expect(extractor.extractInvoice(new File(["x"], "factura.xlsx")))
      .rejects.toThrow("Formato no admitido");
    const oversized = new File([Buffer.alloc(10 * 1024 * 1024 + 1)], "factura.pdf");
    await expect(extractor.extractInvoice(oversized)).rejects.toThrow("El archivo supera 10 MB");
    expect(client.request).not.toHaveBeenCalled();
  });
});
