function distinct(values) {
  return new Set(values.filter((value) => value !== null && value !== undefined)).size;
}

/**
 * Resume las contradicciones presentes únicamente en las sucursales permitidas.
 * @param {Object[]} branchRows Registros visibles del producto por sucursal.
 */
export function deriveProductContradictions(branchRows) {
  const publicPrices = branchRows
    .map((row) => row.precioPublicado)
    .filter((value) => value !== null && value !== undefined);
  return {
    nombresDistintos: distinct(branchRows.map((row) => row.nombrePublicado)),
    preciosPublicadosDistintos: distinct(publicPrices) > 1,
    rangoPreciosPublicados: publicPrices.length
      ? { min: Math.min(...publicPrices), max: Math.max(...publicPrices) }
      : { min: null, max: null },
    preciosNormalizadosDistintos: distinct(branchRows.map((row) => row.precioSinIVA)) > 1,
    existenciasPublicadasDistintas: distinct(
      branchRows.map((row) => row.existenciaPublicada),
    ) > 1,
  };
}

/**
 * Calcula métricas del informe usando solo las sucursales visibles.
 * @param {Object} branches Resumen de las sucursales permitidas.
 * @param {Object[]} products Productos recortados al alcance permitido.
 */
export function summarizeUnification(branches, products) {
  const branchRows = Object.values(branches);
  const filasTotales = branchRows.reduce((total, branch) => total + branch.filasLeidas, 0);
  const resueltas = branchRows.reduce((total, branch) => total + branch.filasResueltas, 0);
  return {
    filasTotales,
    resueltas,
    enRevision: filasTotales - resueltas,
    porcentajeResueltas: filasTotales
      ? Number(((resueltas / filasTotales) * 100).toFixed(2))
      : 0,
    productosConAlMenos2Nombres: products.filter(
      (product) => product.contradicciones.nombresDistintos >= 2,
    ).length,
    productosConPreciosPublicadosDistintos: products.filter(
      (product) => product.contradicciones.preciosPublicadosDistintos,
    ).length,
  };
}
