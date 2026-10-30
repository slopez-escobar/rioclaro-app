import { can } from "../../features/auth/permissions.js";
import { canSeeExistencia, getScope } from "../scope.js";
import {
  copy,
  createCachedLoader,
  groupBy,
  matchesText,
} from "./repositoryUtils.js";

const llaveExistencia = (claveProducto, idSucursal) => `${claveProducto}::${idSucursal}`;

const loadExistencias = createCachedLoader(
  () => import("@data/source/existencias.json"),
  (data) => ({
    records: data.existencias,
    meta: data.meta,
    byProductoSucursal: new Map(data.existencias.map((existencia) => [
      llaveExistencia(existencia.claveProducto, existencia.idSucursal),
      existencia,
    ])),
    bySucursal: groupBy(data.existencias, (existencia) => existencia.idSucursal),
  }),
);

function requirePermission(session) {
  if (!can(session?.rol, "existencias", "ver")) {
    throw new Error("No tienes permiso para ver existencias");
  }
}

function visibleExistencias(session, indexes) {
  const scope = getScope(session);
  if (scope.alcance === "todas") return indexes.records;
  if (scope.alcance === "propio") return [];
  return indexes.bySucursal.get(scope.idSucursal) || [];
}

/**
 * Lista copias de existencias visibles para la sesión y aplica los filtros después del alcance.
 */
export async function listExistencias(session, filtros = {}) {
  requirePermission(session);
  const indexes = await loadExistencias();
  const { idSucursal, claveProducto, estatusStock, texto } = filtros;
  return copy(visibleExistencias(session, indexes).filter((existencia) =>
    (idSucursal == null || existencia.idSucursal === idSucursal)
    && (claveProducto == null || existencia.claveProducto === claveProducto)
    && (estatusStock == null || existencia.estatusStock === estatusStock)
    && matchesText(existencia, texto),
  ));
}

/**
 * Busca una existencia visible por producto y sucursal; devuelve null si no es visible.
 */
export async function getExistencia(session, claveProducto, idSucursal) {
  requirePermission(session);
  const indexes = await loadExistencias();
  const existencia = indexes.byProductoSucursal.get(llaveExistencia(claveProducto, idSucursal));
  return existencia && canSeeExistencia(session, existencia) ? copy(existencia) : null;
}

/**
 * Devuelve los metadatos de corte del inventario sin exponer registros.
 * @returns {Promise<{fechaCorte:string}>} Fecha de corte.
 */
export async function getExistenciasMeta() {
  const { meta } = await loadExistencias();
  return { fechaCorte: meta.fechaCorte };
}
