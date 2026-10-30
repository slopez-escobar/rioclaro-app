/**
 * Crea el adaptador pendiente para Azure AI Language.
 * @returns {{analyze:(text:string)=>Promise<never>}} Adaptador de Azure.
 */
export function createAzureSentiment() {
  return {
    async analyze() {
      throw new Error("Análisis de Azure no implementado (paso B3)");
    },
  };
}
