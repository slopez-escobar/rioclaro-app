import {
  extractSize,
  matchProduct,
  normalizeName,
} from "../../catalog/domain/catalogMatching.js";

function productNames(product) {
  return [
    product.nombre,
    `${product.nombre || ""} ${product.presentacion || ""}`.trim(),
    ...(product.alias || []),
    ...(product.alias || []).map((alias) =>
      `${alias} ${product.presentacion || ""}`.trim()),
  ].filter(Boolean);
}

function sizeMatches(querySize, product) {
  if (!querySize) return true;
  const productSize = extractSize(`${product.nombre || ""} ${product.presentacion || ""}`);
  return productSize
    && productSize.cantidad === querySize.cantidad
    && productSize.unidad === querySize.unidad;
}

function containsEveryWord(product, words) {
  const names = [product.nombre, ...(product.alias || [])]
    .map(normalizeName)
    .filter(Boolean);
  return names.some((name) => words.every((word) => name.split(" ").includes(word)));
}

/**
 * Resuelve una búsqueda de producto en orden: clave, alias/nombre, matcher A5c y contiene.
 */
export function resolveProductQuery(texto, catalogo, aliasIndex = new Map()) {
  const query = String(texto ?? "").trim();
  const noMatch = { claves: [], metodo: "ninguno" };
  if (!query) return noMatch;

  const byKey = new Map(catalogo.map((product) => [
    String(product.claveProducto).toLocaleUpperCase("es-MX"),
    product,
  ]));
  const exactKey = byKey.get(query.toLocaleUpperCase("es-MX"));
  if (exactKey) return { claves: [exactKey.claveProducto], metodo: "clave" };

  const normalizedQuery = normalizeName(query);
  if (!normalizedQuery) return noMatch;
  const aliasMatches = new Set();
  for (const [alias, clave] of aliasIndex) {
    if (normalizeName(alias) === normalizedQuery) aliasMatches.add(clave);
  }
  for (const product of catalogo) {
    if (productNames(product).some((name) => normalizeName(name) === normalizedQuery)) {
      aliasMatches.add(product.claveProducto);
    }
  }
  const exactKeys = [...aliasMatches].filter((clave) => {
    const product = catalogo.find((item) => item.claveProducto === clave);
    return product && sizeMatches(extractSize(query), product);
  });
  if (exactKeys.length) return { claves: exactKeys.sort(), metodo: "alias" };

  const matched = matchProduct({ nombrePublicado: query }, catalogo);
  if (matched.clave) {
    const product = catalogo.find((item) => item.claveProducto === matched.clave);
    if (product && sizeMatches(extractSize(query), product)) {
      return {
        claves: [matched.clave],
        metodo: matched.metodo === "similitud" ? "similitud" : "alias",
      };
    }
  }

  if (!extractSize(query)) {
    const words = normalizedQuery.split(" ").filter(Boolean);
    const claves = catalogo
      .filter((product) => containsEveryWord(product, words))
      .map((product) => product.claveProducto)
      .sort();
    if (claves.length) return { claves, metodo: "contiene" };
  }

  return noMatch;
}
