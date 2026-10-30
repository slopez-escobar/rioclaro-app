import { createCachedLoader, copy } from "./repositoryUtils.js";

const loadCatalog = createCachedLoader(
  () => import("@data/source/catalogos-pedidos.json"),
  (data) => data,
);

/**
 * Devuelve una copia del catálogo de estados, entrega, pago y reglas de pedidos.
 */
export async function getCatalogoPedidos() {
  return copy(await loadCatalog());
}
