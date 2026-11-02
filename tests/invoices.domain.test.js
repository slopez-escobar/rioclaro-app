import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { proveedores as catalogoProveedores } from "@data/source/proveedores-catalogo.json";
import {
  createInvoiceRecord,
  detectDuplicate,
  estimateHumanMinutes,
  evaluateInvoice,
  findRepeatedFolio,
  normalizeAmount,
  normalizeDate,
  normalizeFolio,
  normalizeRfc,
  normalizeText,
  standardName,
  isLowConfidence,
  thresholdFor,
  validateInvoice,
} from "../src/features/invoices/domain/index.js";

const proveedores = [
  { idProveedor: "PRV-01", razonSocial: "Proveedor Uno S.A. de C.V.", rfc: "ABC010203XY1" },
];

/**
 * Congela recursivamente un valor para detectar mutaciones.
 * @param {*} value Valor que se congelará.
 * @returns {*} El mismo valor congelado.
 */
function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/**
 * Crea una extracción válida de referencia para las pruebas.
 * @param {Object} overrides Valores que reemplazan los predeterminados.
 * @returns {Object} Extracción de prueba.
 */
function validExtraction(overrides = {}) {
  const fields = {
    proveedor: { valor: "Proveedor Uno S.A. de C.V.", confianza: 0.97 },
    rfc: { valor: "ABC010203XY1", confianza: 0.97 },
    folio: { valor: "F-100", confianza: 0.97 },
    fecha: { valor: "2026-10-06", confianza: 0.97 },
    total: { valor: 10750.76, confianza: 0.97 },
  };
  return { ...fields, ...overrides };
}

describe("normalizadores", () => {
  it("normaliza RFC y folio sin eliminar ceros iniciales", () => {
    expect(normalizeRfc(" ab c-01.02 ")).toBe("ABC0102");
    expect(normalizeRfc(null)).toBe("");
    expect(normalizeRfc(undefined)).toBe("");
    expect(normalizeFolio("A 8841")).toBe("A8841");
    expect(normalizeFolio("a-8841")).toBe("A8841");
    expect(normalizeFolio("B/2026/0915")).toBe("B20260915");
    expect(normalizeFolio("INV-000412")).toBe("INV000412");
  });

  it("normaliza texto con acentos, puntuación y sufijos societarios", () => {
    expect(normalizeText("  Plásticos, Altiplano S.A. de C.V. ")).toBe("plasticos altiplano");
    expect(normalizeText("Cloros y Derivados Occidente S.A.P.I. de C.V.")).toBe("cloros y derivados occidente");
    expect(normalizeText("Desechables Beltrán S. de R.L. de C.V.")).toBe("desechables beltran");
    expect(normalizeText(null)).toBe("");
  });

  it("normaliza importes numéricos y textuales, y rechaza formatos inválidos", () => {
    expect(normalizeAmount("$10,750.76")).toBe(10750.76);
    expect(normalizeAmount("10,750.76")).toBe(10750.76);
    expect(normalizeAmount("10750.76")).toBe(10750.76);
    expect(normalizeAmount(10.756)).toBe(10.76);
    expect(normalizeAmount("10,75.76")).toBeNull();
    expect(normalizeAmount("$")).toBeNull();
    expect(normalizeAmount(Number.NaN)).toBeNull();
    expect(normalizeAmount(null)).toBeNull();
  });

  it("normaliza fechas día/mes/año con los formatos admitidos y valida el calendario", () => {
    for (const value of [
      "2026-10-06",
      "06/10/2026",
      "06.10.2026",
      "06-OCT-2026",
      "6 de octubre de 2026",
    ]) {
      expect(normalizeDate(value)).toBe("2026-10-06");
    }
    expect(normalizeDate("31/02/2026")).toBeNull();
    expect(normalizeDate("10/06/2026")).toBe("2026-06-10");
    expect(normalizeDate("no es fecha")).toBeNull();
    expect(normalizeDate(null)).toBeNull();
  });
});

describe("validateInvoice", () => {
  it.each([
    ["proveedor", "Falta el proveedor"],
    ["rfc", "Falta el RFC"],
    ["folio", "Falta el folio"],
    ["fecha", "Falta la fecha"],
    ["total", "Falta el total"],
  ])("marca campo requerido faltante: %s", (field, reason) => {
    const result = validateInvoice(validExtraction({ [field]: { valor: "", confianza: 0.97 } }), { proveedores });
    expect(result).toMatchObject({ estado: "Revisar" });
    expect(result.motivos).toContain(reason);
  });

  it.each([
    ["folio", 0.6, "F-100"],
    ["fecha", 0.8, "2026-10-06"],
    ["total", 0.9, 10750.76],
  ])("aplica el umbral inclusivo de %s", (field, threshold, value) => {
    const atThreshold = validateInvoice(
      validExtraction({ [field]: { valor: value, confianza: threshold } }),
      { proveedores },
    );
    const belowThreshold = validateInvoice(
      validExtraction({ [field]: { valor: value, confianza: threshold - 0.01 } }),
      { proveedores },
    );
    expect(atThreshold.estado).toBe("OK");
    expect(belowThreshold.estado).toBe("Revisar");
    expect(belowThreshold.motivos).toContain(
      `Confianza baja en ${field === "rfc" ? "RFC" : field}: ${Math.round((threshold - 0.01) * 100)}%`,
    );
    expect(thresholdFor(field)).toBe(threshold);
    expect(isLowConfidence(field, threshold)).toBe(false);
    expect(isLowConfidence(field, threshold - 0.01)).toBe(true);
  });

  it("usa el umbral por defecto para campos sin calibración y normaliza el RFC", () => {
    const boundary = validateInvoice(validExtraction({
      rfc: { valor: " ab c-010203.xy1 ", confianza: 0.1 },
      total: { valor: 10750.76, confianza: 0.9 },
    }), { proveedores });
    expect(thresholdFor("campo-desconocido")).toBe(0.8);
    expect(isLowConfidence("campo-desconocido", 0.8)).toBe(false);
    expect(isLowConfidence("campo-desconocido", 0.79)).toBe(true);
    expect(thresholdFor("proveedor")).toBeNull();
    expect(thresholdFor("rfc")).toBeNull();
    expect(isLowConfidence("proveedor", 0.1)).toBe(false);
    expect(isLowConfidence("rfc", 0.1)).toBe(false);
    expect(boundary).toEqual({
      estado: "OK",
      motivos: [],
      proveedorId: "PRV-01",
      razonSocial: "Proveedor Uno S.A. de C.V.",
    });
  });

  it("marca un RFC ausente del catálogo con el motivo exacto", () => {
    const result = validateInvoice(validExtraction({ rfc: { valor: "XYZ010203XY1", confianza: 0.97 } }), { proveedores });
    expect(result).toEqual({
      estado: "Revisar",
      motivos: ["Proveedor no registrado: el RFC XYZ010203XY1 no existe en el catálogo de proveedores"],
      proveedorId: null,
      razonSocial: null,
    });
  });
});

describe("detectDuplicate y findRepeatedFolio", () => {
  const existing = {
    id: "INV-1",
    archivo: "FACTURA original.pdf",
    hash: "hash-original",
    rfc: "ABC010203XY1",
    folio: "A-8841",
    total: 10750.76,
    estado: "Rechazada",
  };

  it("detecta duplicados por datos aunque cambien el formato del folio y el hash", () => {
    expect(detectDuplicate({
      hash: "hash-foto",
      rfc: { valor: " abc-010203xy1 " },
      folio: { valor: "a 8841" },
      total: { valor: "$10,750.76" },
    }, [existing])).toEqual({
      duplicada: true,
      tipo: "datos",
      de: { id: "INV-1", archivo: "FACTURA original.pdf" },
    });
  });

  it("detecta por hash incluso cuando faltan los datos y retorna el más antiguo", () => {
    const first = { ...existing, id: "INV-0", archivo: "primera.pdf", hash: "same-hash" };
    const second = { ...existing, id: "INV-2", archivo: "segunda.pdf", hash: "same-hash" };
    expect(detectDuplicate({ hash: "same-hash" }, [first, second])).toEqual({
      duplicada: true,
      tipo: "hash",
      de: { id: "INV-0", archivo: "primera.pdf" },
    });
  });

  it("ordena coincidencias por subidaEn cuando las fechas están disponibles", () => {
    const newer = { ...existing, id: "INV-2", archivo: "nueva.pdf", hash: "same-hash", subidaEn: "2026-10-20T00:00:00Z" };
    const older = { ...existing, id: "INV-1", archivo: "antigua.pdf", hash: "same-hash", subidaEn: "2026-10-10T00:00:00Z" };
    expect(detectDuplicate({ hash: "same-hash" }, [newer, older]).de).toEqual({
      id: "INV-1",
      archivo: "antigua.pdf",
    });
  });

  it("no confunde total distinto con duplicado y maneja vacíos o datos incompletos", () => {
    expect(detectDuplicate({ ...existing, hash: "new", total: 10750.77 }, [existing]).duplicada).toBe(false);
    expect(detectDuplicate({ ...existing, hash: "new", rfc: null }, [existing]).duplicada).toBe(false);
    expect(detectDuplicate({ hash: "new" }, []).duplicada).toBe(false);
    expect(detectDuplicate({ hash: "hash-original" }, [existing]).tipo).toBe("hash");
  });

  it("encuentra folio repetido con otro total sin llamarlo duplicado", () => {
    const result = findRepeatedFolio({
      rfc: "abc010203xy1",
      folio: "A 8841",
      total: 6603.18,
    }, [existing]);
    expect(result).toEqual({
      repetido: true,
      de: { id: "INV-1", archivo: "FACTURA original.pdf", total: 10750.76 },
    });
    expect(findRepeatedFolio({ rfc: null, folio: "A-8841", total: 1 }, [existing])).toEqual({
      repetido: false,
      de: null,
    });
    expect(findRepeatedFolio({ rfc: existing.rfc, folio: existing.folio, total: existing.total }, [existing]).repetido).toBe(false);
  });
});

describe("evaluateInvoice", () => {
  const archivo = { nombre: "nueva.pdf", hash: "hash-nuevo" };
  const existing = {
    id: "INV-1",
    archivo: "anterior.pdf",
    hash: "hash-anterior",
    rfc: "ABC010203XY1",
    folio: "F-100",
    total: 10750.76,
    estado: "Duplicada",
  };

  it("da prioridad a Duplicada sobre datos incompletos o de baja confianza", () => {
    const result = evaluateInvoice(validExtraction({
      proveedor: { valor: null, confianza: 0.4 },
    }), archivo, { proveedores, existentes: [existing] });
    expect(result.estado).toBe("Duplicada");
    expect(result.motivos).toEqual(["Duplicada por datos: mismo RFC, folio y total que anterior.pdf"]);
    expect(result.duplicadoDe).toEqual({ id: "INV-1", archivo: "anterior.pdf", tipo: "datos" });
  });

  it("mantiene motivos de validación y agrega la advertencia de folio repetido", () => {
    const result = evaluateInvoice(validExtraction({ total: { valor: 6603.18, confianza: 0.97 } }), archivo, {
      proveedores,
      existentes: [existing],
    });
    expect(result.estado).toBe("Revisar");
    expect(result.motivos).toContain("Folio repetido con total distinto: F-100 ya existe en la factura anterior.pdf por $10750.76");
    expect(result.duplicadoDe).toBeNull();
  });
});

describe("standardName", () => {
  it("genera el nombre RFC_folio_fecha con la extensión minúscula", () => {
    expect(standardName({
      archivo: "FACTURA 8841 (1).PDF",
      rfc: "CDO-920402.DFT",
      folio: "A-8841",
      fecha: "06/10/2026",
    })).toBe("CDO920402DFT_A-8841_2026-10-06.pdf");
    expect(standardName("FACTURA 8841 (1).pdf")).toBeNull();
    expect(standardName({ archivo: "sin-datos.pdf", rfc: "", folio: "A1", fecha: "2026-10-06" })).toBeNull();
  });
});

describe("estimateHumanMinutes y createInvoiceRecord", () => {
  it("estima minutos por estado con los supuestos del prototipo", () => {
    expect(estimateHumanMinutes([
      { estado: "Revisar" },
      { estado: "OK" },
      { estado: "Aprobada" },
      { estado: "Duplicada" },
      { estado: "Rechazada" },
    ])).toEqual({
      minutos: 6,
      horas: 0.1,
      desglose: { Revisar: 3, OK: 1, Aprobada: 1, Duplicada: 1, Rechazada: 0 },
    });
  });

  it("construye un registro sin generar fechas ni identificadores", () => {
    const extraccion = validExtraction();
    const archivo = { nombre: "FACTURA 8841.pdf", hash: "hash-1" };
    const evaluacion = { estado: "OK", motivos: [], proveedorId: "PRV-01", duplicadoDe: null };
    expect(createInvoiceRecord({
      id: "INV-9",
      extraccion,
      archivo,
      evaluacion,
      subidaPor: "laura",
      subidaEn: "2026-10-25T12:00:00Z",
    })).toEqual({
      id: "INV-9",
      archivo: "FACTURA 8841.pdf",
      nombreEstandar: "ABC010203XY1_F-100_2026-10-06.pdf",
      hash: "hash-1",
      subidaEn: "2026-10-25T12:00:00Z",
      subidaPor: "laura",
      proveedor: "Proveedor Uno S.A. de C.V.",
      rfc: "ABC010203XY1",
      folio: "F-100",
      fecha: "2026-10-06",
      total: 10750.76,
      confianza: {
        proveedor: 0.97,
        rfc: 0.97,
        folio: 0.97,
        fecha: 0.97,
        total: 0.97,
      },
      estado: "OK",
      motivos: [],
      duplicadoDe: null,
      proveedorId: "PRV-01",
      requiereDireccion: false,
      aprobaciones: [],
      historial: [],
      decididaPor: null,
      decididaEn: null,
    });
  });

  it("marca la aprobación de Dirección solo cuando el total supera el umbral", () => {
    const crear = (total) => createInvoiceRecord({
      id: "INV-UMBRAL",
      extraccion: validExtraction({ total: { valor: total, confianza: 0.97 } }),
      archivo: { nombre: "factura.pdf", hash: "hash" },
      evaluacion: { estado: "OK", motivos: [], proveedorId: "PRV-01", duplicadoDe: null },
      subidaPor: "laura",
      subidaEn: "2026-10-25T12:00:00Z",
    });

    expect(crear(100000).requiereDireccion).toBe(false);
    expect(crear(100000.01).requiereDireccion).toBe(true);
  });

  it("no muta argumentos profundamente congelados", () => {
    const extraction = deepFreeze(validExtraction());
    const catalog = deepFreeze([{ ...proveedores[0] }]);
    const existing = deepFreeze([{
      id: "INV-1",
      archivo: "anterior.pdf",
      hash: "hash-anterior",
      rfc: "ABC010203XY1",
      folio: "F-100",
      total: 10750.76,
    }]);
    const file = deepFreeze({ nombre: "nueva.pdf", hash: "hash-nuevo" });
    const evaluation = deepFreeze({ estado: "OK", motivos: [], proveedorId: "PRV-01", duplicadoDe: null });
    const invoices = deepFreeze([{ estado: "OK" }, { estado: "Revisar" }]);

    normalizeRfc("abc-01. ");
    normalizeFolio("a-0001");
    normalizeText("Empresa S.A. de C.V.");
    normalizeAmount("$10.00");
    normalizeDate("6 de octubre de 2026");
    validateInvoice(extraction, { proveedores: catalog });
    detectDuplicate(extraction, existing);
    findRepeatedFolio(extraction, existing);
    evaluateInvoice(extraction, file, { proveedores: catalog, existentes: existing });
    standardName({ archivo: file.nombre, ...extraction });
    estimateHumanMinutes(invoices);
    createInvoiceRecord({
      id: "INV-2",
      extraccion: extraction,
      archivo: file,
      evaluacion: evaluation,
      subidaPor: "laura",
      subidaEn: "2026-10-25T12:00:00Z",
    });

    expect(Object.isFrozen(extraction)).toBe(true);
    expect(Object.isFrozen(catalog[0])).toBe(true);
    expect(Object.isFrozen(existing[0])).toBe(true);
    expect(Object.isFrozen(file)).toBe(true);
    expect(Object.isFrozen(evaluation.motivos)).toBe(true);
    expect(Object.isFrozen(invoices[0])).toBe(true);
  });
});

describe("aceptación con los datos del repositorio", () => {
  const manifest = JSON.parse(readFileSync(new URL("../public/facturas-prueba/manifest.json", import.meta.url), "utf8"));
  const providerCatalog = { proveedores: catalogoProveedores };

  it("evalúa en orden los 11 casos reales del manifiesto", () => {
    expect(manifest.facturas).toHaveLength(11);
    expect(providerCatalog.proveedores).toHaveLength(60);

    const existentes = [];
    const resultados = manifest.facturas.map((factura, index) => {
      const esperado = factura.esperado;
      const totalIlegible = esperado.totalLegible === false;
      const extraccion = {
        proveedor: { valor: esperado.proveedor, confianza: 0.97 },
        rfc: { valor: esperado.rfc, confianza: 0.97 },
        folio: { valor: esperado.folio, confianza: 0.97 },
        fecha: { valor: esperado.fecha, confianza: 0.97 },
        total: { valor: totalIlegible ? null : esperado.total, confianza: totalIlegible ? 0.41 : 0.97 },
      };
      const archivo = { nombre: factura.archivo, hash: factura.sha256 };
      const evaluacion = evaluateInvoice(extraccion, archivo, {
        proveedores: providerCatalog.proveedores,
        existentes,
      });
      existentes.push(createInvoiceRecord({
        id: `TEST-${index + 1}`,
        extraccion,
        archivo,
        evaluacion,
        subidaPor: "prueba",
        subidaEn: `2026-10-25T00:00:${String(index).padStart(2, "0")}Z`,
      }));
      return { factura, extraccion, evaluacion };
    });

    expect(resultados.map(({ evaluacion, factura }) => [factura.archivo, evaluacion.estado]))
      .toEqual(manifest.facturas.map((factura) => [factura.archivo, factura.estadoEsperado]));

    const photoDuplicate = resultados.find(({ factura }) => factura.archivo === "20261016_091523.jpg");
    expect(photoDuplicate.evaluacion).toMatchObject({
      estado: "Duplicada",
      duplicadoDe: { archivo: "FACTURA 8841 (1).pdf", tipo: "datos" },
    });

    const hashDuplicate = resultados.find(({ factura }) => factura.archivo === "factura_final2 - copia.pdf");
    expect(hashDuplicate.evaluacion).toMatchObject({
      estado: "Duplicada",
      duplicadoDe: { archivo: "factura_final2.pdf", tipo: "hash" },
    });

    const repeatedFolio = resultados.find(({ factura }) => factura.archivo === "FACTURA 8841 (2).pdf");
    expect(repeatedFolio.evaluacion.estado).toBe("Revisar");
    expect(repeatedFolio.evaluacion.duplicadoDe).toBeNull();
    expect(repeatedFolio.evaluacion.motivos).toContain(
      "Folio repetido con total distinto: A-8841 ya existe en la factura FACTURA 8841 (1).pdf por $10750.76",
    );

    const unregistered = resultados.find(({ factura }) => factura.archivo === "Factura_proveedor_nuevo.pdf");
    expect(unregistered.evaluacion.motivos).toContain(
      `Proveedor no registrado: el RFC ${unregistered.extraccion.rfc.valor} no existe en el catálogo de proveedores`,
    );
    const blurry = resultados.find(({ factura }) => factura.archivo === "factura_urgente.jpg");
    expect(blurry.evaluacion.estado).toBe("Revisar");

    const first = resultados[0];
    expect(standardName({
      archivo: first.factura.archivo,
      rfc: first.extraccion.rfc,
      folio: first.extraccion.folio,
      fecha: first.extraccion.fecha,
    })).toBe("CDO920402DFT_A-8841_2026-10-06.pdf");
  });
});
