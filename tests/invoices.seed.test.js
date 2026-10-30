import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DIRECTION_APPROVAL_THRESHOLD } from "../src/config/constants.js";
import {
  normalizeFolio,
  normalizeRfc,
  pendingApprovals,
  standardName,
} from "../src/features/invoices/domain/index.js";

const seed = JSON.parse(
  readFileSync(new URL("../src/data/source/seedInvoices.json", import.meta.url), "utf8"),
);
const providerCatalog = JSON.parse(
  readFileSync(
    new URL("../src/data/source/proveedores-catalogo.json", import.meta.url),
    "utf8",
  ),
);
const testManifest = JSON.parse(
  readFileSync(new URL("../public/facturas-prueba/manifest.json", import.meta.url), "utf8"),
);
const invoices = seed.facturas;
const providersByRfc = new Map(
  providerCatalog.proveedores.map((provider) => [normalizeRfc(provider.rfc), provider]),
);
const expectedStateCounts = {
  Aprobada: 4,
  OK: 2,
  Revisar: 1,
  Duplicada: 1,
  Rechazada: 1,
};

function getValue(field) {
  return field !== null && typeof field === "object" && Object.hasOwn(field, "valor")
    ? field.valor
    : field;
}

function dateValues(value) {
  if (Array.isArray(value)) return value.flatMap(dateValues);
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => {
    if (
      typeof child === "string"
      && /(?:fecha|en)$/i.test(key)
      && /^\d{4}-\d{2}-\d{2}(?:$|T)/.test(child)
    ) {
      return [child];
    }
    return dateValues(child);
  });
}

function hasFileContentField(value) {
  if (Array.isArray(value)) return value.some(hasFileContentField);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(
    ([key, child]) => /base64|blob|contenido/i.test(key) || hasFileContentField(child),
  );
}

describe("semilla y catálogo de proveedores", () => {
  it("lee los datos generados esperados y valida sus identificadores y hashes", () => {
    expect(seed.facturas).toHaveLength(9);
    expect(providerCatalog.proveedores).toHaveLength(60);
    expect(
      providerCatalog.proveedores.every(
        (provider) =>
          Object.keys(provider).sort().join(",")
          === [
          "idProveedor",
          "razonSocial",
          "nombreComercial",
          "rfc",
          "categoria",
          "idEmpleadoComprador",
          ].sort().join(","),
      ),
    ).toBe(true);
    expect(invoices.map((invoice) => invoice.id)).toEqual(
      Array.from({ length: 9 }, (_, index) => `FAC-${String(index + 1).padStart(4, "0")}`),
    );
    expect(new Set(invoices.map((invoice) => invoice.id)).size).toBe(9);
    expect(invoices.every((invoice) => typeof invoice.hash === "string" && invoice.hash.length > 0))
      .toBe(true);
    expect(new Set(invoices.map((invoice) => invoice.hash)).size).toBe(9);
  });

  it("mantiene los conteos de estados documentados", () => {
    const counts = Object.fromEntries(
      Object.keys(expectedStateCounts).map((state) => [
        state,
        invoices.filter((invoice) => invoice.estado === state).length,
      ]),
    );
    expect(counts).toEqual(expectedStateCounts);
  });

  it("relaciona el RFC de cada proveedor registrado con su id", () => {
    for (const invoice of invoices) {
      const rfc = normalizeRfc(getValue(invoice.rfc));
      const provider = providersByRfc.get(rfc);

      if (invoice.id === "FAC-0009") {
        expect(invoice.estado).toBe("Rechazada");
        expect(invoice.proveedorId).toBeNull();
        expect(provider).toBeUndefined();
        continue;
      }

      expect(provider, invoice.id).toBeDefined();
      expect(invoice.proveedorId, invoice.id).toBe(provider.idProveedor);
    }
  });

  it("calcula requiereDireccion y las aprobaciones pendientes según el modelo", () => {
    for (const invoice of invoices) {
      expect(invoice.requiereDireccion).toBe(
        getValue(invoice.total) > DIRECTION_APPROVAL_THRESHOLD,
      );
      if (invoice.estado === "Aprobada") {
        expect(pendingApprovals(invoice), invoice.id).toEqual([]);
      }
    }

    const approvedAtFinance = invoices.find((invoice) => invoice.id === "FAC-0006");
    expect(approvedAtFinance.estado).toBe("OK");
    expect(pendingApprovals(approvedAtFinance)).toEqual(["direccion"]);
  });

  it("conserva referencia y motivo de la factura duplicada", () => {
    const duplicate = invoices.find((invoice) => invoice.estado === "Duplicada");
    expect(invoices.some((invoice) => invoice.id === duplicate.duplicadoDe?.id)).toBe(true);
    expect(duplicate.motivos[0]).toMatch(/^Duplicada por datos/);
  });

  it("usa nombres estandarizados y no contiene fechas posteriores al 25 de octubre de 2026", () => {
    for (const invoice of invoices) {
      expect(invoice.nombreEstandar, invoice.id).toBe(standardName(invoice));
      for (const value of dateValues(invoice)) {
        expect(Date.parse(value), `${invoice.id}: ${value}`).toBeLessThanOrEqual(
          Date.parse("2026-10-25T23:59:59.999Z"),
        );
      }
    }
  });

  it("tiene historial cronológico iniciado por la subida y no almacena contenido de archivos", () => {
    for (const invoice of invoices) {
      expect(invoice.historial.length, invoice.id).toBeGreaterThan(0);
      expect(invoice.historial[0].accion, invoice.id).toBe("subida");
      const timestamps = invoice.historial.map((entry) => Date.parse(entry.fecha));
      expect(timestamps.every(Number.isFinite), invoice.id).toBe(true);
      expect(
        timestamps.every((timestamp, index) => index === 0 || timestamp >= timestamps[index - 1]),
        invoice.id,
      ).toBe(true);
      expect(hasFileContentField(invoice), invoice.id).toBe(false);
    }
  });

  it("no colisiona por RFC y folio con ninguna factura de prueba", () => {
    const seededKeys = new Set(
      invoices.map(
        (invoice) =>
          `${normalizeRfc(getValue(invoice.rfc))}|${normalizeFolio(getValue(invoice.folio))}`,
      ),
    );

    expect(testManifest.facturas).toHaveLength(11);
    for (const testInvoice of testManifest.facturas) {
      const key = `${normalizeRfc(testInvoice.esperado.rfc)}|${normalizeFolio(testInvoice.esperado.folio)}`;
      expect(seededKeys.has(key), testInvoice.archivo).toBe(false);
    }
  });
});
