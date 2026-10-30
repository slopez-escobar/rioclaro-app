import { normalizeRfc } from "../../features/invoices/domain/normalize.js";

let providersPromise;

function loadProviders() {
  if (!providersPromise) {
    providersPromise = import("../source/proveedores-catalogo.json").then(
      (module) => module.default.proveedores,
    );
  }
  return providersPromise;
}

/**
 * Devuelve el catálogo recortado de proveedores mediante carga diferida.
 * @returns {Promise<Object[]>} Proveedores disponibles.
 */
export async function listProveedores() {
  return (await loadProviders()).map((provider) => ({ ...provider }));
}

/**
 * Busca un proveedor por RFC normalizado.
 * @param {string} rfc RFC del proveedor.
 * @returns {Promise<Object|null>} Proveedor encontrado o null.
 */
export async function findByRfc(rfc) {
  const normalizedRfc = normalizeRfc(rfc);
  if (!normalizedRfc) return null;
  const providers = await loadProviders();
  const provider = providers.find((item) => normalizeRfc(item.rfc) === normalizedRfc);
  return provider ? { ...provider } : null;
}
