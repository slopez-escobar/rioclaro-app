import {
  copy,
  createCachedLoader,
  normalizeText,
} from "./repositoryUtils.js";

const loadCatalogo = createCachedLoader(
  () => import("@data/source/catalogo-productos.json"),
  (data) => ({
    productos: data.productos,
    byClave: new Map(data.productos.map((producto) => [producto.claveProducto, producto])),
    aliasIndex: new Map(data.productos.flatMap((producto) => [
      [normalizeText(producto.nombre), producto.claveProducto],
      ...producto.alias.map((alias) => [normalizeText(alias), producto.claveProducto]),
    ])),
  }),
);

/**
 * Lista copias del catálogo de productos.
 */
export async function listProductos() {
  return copy((await loadCatalogo()).productos);
}

/**
 * Busca una copia de producto por clave o devuelve null si no existe.
 */
export async function getProducto(clave) {
  const producto = (await loadCatalogo()).byClave.get(clave);
  return producto ? copy(producto) : null;
}

/**
 * Devuelve una copia del índice normalizado de nombres y alias.
 */
export async function getAliasIndex() {
  return copy((await loadCatalogo()).aliasIndex);
}
