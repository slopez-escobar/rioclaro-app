import { parsePolicy, policyToFragments } from "./parsePolicy.js";

const POLICY_MARKDOWNS = import.meta.glob("@data/conocimiento/POL-*.md", {
  query: "?raw",
  import: "default",
});
let knowledgeBasePromise;

function markdownId(filePath) {
  return filePath.replace(/\\/g, "/").match(/(?:^|\/)(POL-\d{2})_[^/]+\.md$/)?.[1] || null;
}

function indexMap(indice) {
  const entries = Array.isArray(indice) ? indice : indice?.politicas;
  if (!Array.isArray(entries)) {
    throw new Error("El índice de políticas no contiene una lista válida.");
  }
  return new Map(entries.map((entry) => [entry.id, entry]));
}

/**
 * Construye la base desde los textos y el índice, sin acceder al entorno.
 * @param {{markdowns:Object|Array,indice:Object|Array}} input Textos e índice de políticas.
 * @returns {{politicas:Object[],fragmentos:Object[]}} Políticas y fragmentos vigentes.
 */
export function createKnowledgeBase({ markdowns, indice }) {
  const index = indexMap(indice);
  const entries = Array.isArray(markdowns)
    ? markdowns.map((entry) => Array.isArray(entry) ? entry : [entry.path || entry.file, entry.markdown || entry.text])
    : Object.entries(markdowns || {});
  const politicas = entries
    .filter(([filePath]) => /^POL-/.test(String(filePath).replace(/\\/g, "/").split("/").pop() || ""))
    .map(([filePath, markdown]) => ({
      filePath,
      politica: parsePolicy(markdown),
    }))
    .filter(({ politica }) => {
      const metadata = index.get(politica.id);
      return Boolean(
        metadata
        && metadata.vigente === true
        && politica.vigente === true,
      );
    })
    .map(({ politica }) => ({
      ...politica,
      cargarEnAsistenteClientes: index.get(politica.id).cargarEnAsistenteClientes === true,
      responsableIndice: index.get(politica.id).responsable,
    }));

  return {
    politicas,
    fragmentos: politicas.flatMap(policyToFragments),
  };
}

/**
 * Carga una vez y de forma diferida las políticas Markdown y su índice.
 * @returns {Promise<{politicas:Object[],fragmentos:Object[]}>} Base vigente.
 */
export function loadKnowledgeBase() {
  if (!knowledgeBasePromise) {
    const loaders = Object.entries(POLICY_MARKDOWNS)
      .filter(([filePath]) => markdownId(filePath))
      .map(async ([filePath, load]) => [filePath, await load()]);
    knowledgeBasePromise = Promise.all([
      Promise.all(loaders),
      import("@data/conocimiento/indice-politicas.json"),
    ]).then(([markdowns, indiceModule]) =>
      createKnowledgeBase({ markdowns, indice: indiceModule.default }),
    );
  }
  return knowledgeBasePromise;
}
