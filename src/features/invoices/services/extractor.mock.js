import { hashFile } from "../../../shared/utils/hashFile.js";

let defaultManifestPromise;

function loadDefaultManifest() {
  if (!defaultManifestPromise) {
    defaultManifestPromise = fetch(
      `${import.meta.env.BASE_URL}facturas-prueba/manifest.json`,
    ).then((response) => {
      if (!response.ok) {
        throw new Error(`No se pudo cargar el manifiesto de facturas (${response.status})`);
      }
      return response.json();
    });
  }
  return defaultManifestPromise;
}

function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function extractedField(value, confidence) {
  return { valor: value ?? null, confianza: confidence };
}

/**
 * Crea un extractor simulado usando el manifiesto de facturas de prueba.
 * @param {Object} options Cargador del manifiesto y demora simulada.
 * @returns {{extractInvoice: (file: File) => Promise<Object>}} Extractor simulado.
 */
export function createMockExtractor({ loadManifest = loadDefaultManifest, delayMs = 400 } = {}) {
  let manifestPromise;

  async function getManifest() {
    if (!manifestPromise) manifestPromise = Promise.resolve().then(loadManifest);
    return manifestPromise;
  }

  return {
    /**
     * Extrae los campos esperados del manifiesto o devuelve campos vacíos.
     * @param {File} file Archivo que se va a analizar.
     * @returns {Promise<Object>} Campos extraídos y metadatos de simulación.
     */
    async extractInvoice(file) {
      const startedAt = globalThis.performance.now();
      const hash = await hashFile(file);
      const manifest = await getManifest();
      const cases = Array.isArray(manifest?.facturas) ? manifest.facturas : [];
      const match = cases.find((invoice) => invoice.sha256 === hash)
        ?? cases.find((invoice) => invoice.archivo === file.name);
      await wait(delayMs);

      const meta = {
        origen: "simulado",
        archivo: file.name,
        hash,
        tiempoMs: globalThis.performance.now() - startedAt,
      };

      if (!match) {
        return {
          proveedor: extractedField(null, 0),
          rfc: extractedField(null, 0),
          folio: extractedField(null, 0),
          fecha: extractedField(null, 0),
          total: extractedField(null, 0),
          meta: { ...meta, motivo: "Archivo no reconocido por el simulador" },
        };
      }

      const expected = match.esperado ?? {};
      const unreadableTotal = expected.totalLegible === false;
      const confidence = unreadableTotal
        ? 0.9
        : match.formato === "pdf"
          ? 0.98
          : 0.93;

      return {
        proveedor: extractedField(expected.proveedor, confidence),
        rfc: extractedField(expected.rfc, confidence),
        folio: extractedField(expected.folio, confidence),
        fecha: extractedField(expected.fecha, confidence),
        total: unreadableTotal
          ? extractedField(null, 0.41)
          : extractedField(expected.total, confidence),
        meta,
      };
    },
  };
}
