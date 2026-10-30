import { ESTATUS_ORDEN } from "./stockLabels.js";

/**
 * Agrupa existencias visibles por producto y calcula los totales de esos registros.
 */
export function groupByProduct(registros, catalogo) {
  const productsByKey = new Map(catalogo.map((product) => [product.claveProducto, product]));
  const rows = new Map();

  for (const record of registros) {
    const product = productsByKey.get(record.claveProducto);
    if (!product) continue;
    if (!rows.has(record.claveProducto)) {
      rows.set(record.claveProducto, {
        claveProducto: product.claveProducto,
        nombre: product.nombre,
        categoria: product.categoria,
        presentacion: product.presentacion,
        unidadVenta: product.unidadVenta,
        precioListaMXN: product.precioListaMXN,
        sucursales: {},
        totales: { existencia: 0, comprometido: 0, disponible: 0 },
        peorEstatus: record.estatusStock,
      });
    }

    const row = rows.get(record.claveProducto);
    row.sucursales[record.idSucursal] = record;
    row.totales.existencia += record.existencia;
    row.totales.comprometido += record.comprometido;
    row.totales.disponible += record.disponible;
    const recordRank = ESTATUS_ORDEN.indexOf(record.estatusStock);
    const currentRank = ESTATUS_ORDEN.indexOf(row.peorEstatus);
    if (recordRank >= 0 && (currentRank < 0 || recordRank < currentRank)) {
      row.peorEstatus = record.estatusStock;
    }
  }

  return [...rows.values()];
}

/**
 * Filtra grupos ya limitados a los registros visibles de la sesión.
 */
export function matchesInventoryFilters(row, filters = {}) {
  const selectedBranch = filters.idSucursal;
  const branchIds = selectedBranch
    ? [selectedBranch]
    : Object.keys(row.sucursales);
  const visibleRecords = branchIds
    .map((id) => row.sucursales[id])
    .filter(Boolean);
  const resolution = filters.texto;
  const textMatches = resolution == null
    || (resolution.claves || []).includes(row.claveProducto);
  return textMatches
    && (!filters.categoria || row.categoria === filters.categoria)
    && (!filters.estatus
      || visibleRecords.some((record) => record.estatusStock === filters.estatus))
    && (!selectedBranch || Boolean(row.sucursales[selectedBranch]));
}
