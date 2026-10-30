const REPOSITORY_LOADERS = {
  clientes: () => import("./clientesRepository.js"),
  pedidos: () => import("./pedidosRepository.js"),
  existencias: () => import("./existenciasRepository.js"),
  quejas: () => import("./quejasRepository.js"),
  catalogo: () => import("./catalogoRepository.js"),
  unificacion: () => import("./unificacionRepository.js"),
  ventasConciliacion: () => import("./ventasConciliacionRepository.js"),
  sucursales: () => import("./sucursalesRepository.js"),
  directorio: () => import("./directorioRepository.js"),
};

/**
 * Carga el repositorio de datos solicitado sin cargar los demás repositorios.
 * @param {string} nombre Nombre del repositorio.
 */
export function loadDataRepository(nombre) {
  const load = REPOSITORY_LOADERS[nombre];
  if (!load) throw new Error(`Repositorio de datos desconocido: ${nombre}`);
  return load();
}
