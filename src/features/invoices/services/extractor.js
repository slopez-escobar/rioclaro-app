import { USE_AZURE } from "../../../config/env.js";
import { createAzureExtractor } from "./extractor.azure.js";
import { createMockExtractor } from "./extractor.mock.js";

export const extractor = USE_AZURE ? createAzureExtractor() : createMockExtractor();

/**
 * Delega la extracción al proveedor configurado.
 * @param {File} file Archivo que se va a analizar.
 * @returns {Promise<Object>} Campos extraídos y metadatos del proveedor.
 */
export function extractInvoice(file) {
  return extractor.extractInvoice(file);
}
