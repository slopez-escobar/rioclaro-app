const BLURRY_READING = {
  proveedor: { valor: "Plásticos Soptodos Baje S. de R.L. de C.V.", confianza: 0.995 },
  rfc: { valor: null, confianza: 0 },
  folio: { valor: null, confianza: 0 },
  fecha: { valor: null, confianza: 0 },
  total: { valor: null, confianza: 0 },
};

const READING_CASES = {
  "FACTURA 8841 (1).pdf": {
    proveedor: { valor: "CY", confianza: 0.82 },
    rfc: { valor: "CDO920402DFT", confianza: 0.723 },
    folio: { valor: "A-8841", confianza: 0.798 },
    fecha: { valor: "2026-10-06", confianza: 0.983 },
    total: { valor: 10750.76, confianza: 0.982 },
  },
  "20261016_091523.jpg": {
    proveedor: { valor: "CY", confianza: 0.738 },
    rfc: { valor: "CDO920402DFT", confianza: 0.821 },
    folio: { valor: "A-8841", confianza: 0.683 },
    fecha: { valor: "2026-10-06", confianza: 0.979 },
    total: { valor: 10750.76, confianza: 0.976 },
  },
};

/**
 * Crea un extractor determinista con lecturas capturadas en Document Intelligence.
 * @returns {{extractInvoice: Function}} Extractor de evidencia.
 */
export function createRealReadingExtractor() {
  return {
    async extractInvoice(file) {
      if (file?.name === "factura_urgente.jpg") {
        return structuredClone(BLURRY_READING);
      }

      const reading = READING_CASES[file?.name];
      if (!reading) throw new Error(`No hay una lectura real registrada para ${file?.name ?? "el archivo"}.`);
      return structuredClone(reading);
    },
  };
}
