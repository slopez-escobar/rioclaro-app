/**
 * Crea el extractor reservado para la integración con Azure Document Intelligence.
 * @returns {{extractInvoice: (file: File) => Promise<Object>}} Extractor de Azure.
 */
export function createAzureExtractor() {
  return {
    /**
     * Indica que la integración con Azure se implementará en el paso B3.
     * @param {File} file Archivo que se analizaría.
     * @returns {Promise<Object>} Esta implementación no devuelve resultados.
     */
    async extractInvoice() {
      throw new Error("Extractor de Azure no implementado (paso B3)");
    },
  };
}
