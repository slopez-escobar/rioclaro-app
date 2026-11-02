import { describe, it, expect } from "vitest";
import {
  CONFIDENCE_THRESHOLD,
  FIELD_CONFIDENCE_THRESHOLDS,
  STORAGE_PREFIX,
  STORAGE_KEYS,
} from "../src/config/constants.js";
import { empresa, sucursales, SUCURSALES_POR_ID } from "../src/config/sucursales.js";

describe("configuración base", () => {
  it("usa el umbral de confianza de 80%", () => expect(CONFIDENCE_THRESHOLD).toBe(0.8));
  it("conserva los umbrales calibrados por campo", () => {
    expect(FIELD_CONFIDENCE_THRESHOLDS).toEqual({
      folio: 0.6,
      fecha: 0.8,
      total: 0.9,
    });
  });
  it("prefija las claves de localStorage", () => {
    expect(STORAGE_PREFIX).toBe("rc:v1:");
    expect(Object.keys(STORAGE_KEYS)).toEqual([
      "session",
      "invoices",
      "chat",
      "disabledAccounts",
      "adminAudit",
      "complaints",
      "complaintActions",
    ]);
  });
  it("lee la empresa y las sucursales desde el catálogo compartido", () => {
    expect(empresa.nombre).toBe("Distribuidora Río Claro");
    expect(empresa.giro).toBe("Distribución de productos de limpieza e higiene");
    expect(sucursales).toHaveLength(5);
    expect(SUCURSALES_POR_ID.gdl.nombre).toBe("Río Claro Guadalajara");
  });
});
