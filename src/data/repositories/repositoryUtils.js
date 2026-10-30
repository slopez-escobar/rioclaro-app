/**
 * Crea un cargador diferido que comparte la promesa y los índices construidos.
 * @param {Function} importer Importador dinámico del JSON.
 * @param {Function} buildIndexes Constructor de los índices internos.
 */
export function createCachedLoader(importer, buildIndexes) {
  let promise;
  return () => {
    if (!promise) {
      promise = importer().then((module) => buildIndexes(module.default));
    }
    return promise;
  };
}

/**
 * Agrupa registros por el valor indicado sin modificar los datos originales.
 */
export function groupBy(records, getKey) {
  const groups = new Map();
  for (const record of records) {
    const key = getKey(record);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  return groups;
}

/**
 * Normaliza texto para búsquedas que ignoran mayúsculas y acentos.
 */
export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX");
}

/**
 * Busca el texto normalizado en la representación completa del registro.
 */
export function matchesText(record, text) {
  if (text === undefined || text === null || text === "") return true;
  return normalizeText(JSON.stringify(record)).includes(normalizeText(text));
}

/**
 * Devuelve una copia independiente del valor.
 */
export function copy(value) {
  return structuredClone(value);
}
