import { createCachedLoader, copy } from "./repositoryUtils.js";
import { normalizeName } from "../../features/catalog/domain/catalogMatching.js";
import { can } from "../../features/auth/permissions.js";
import { getScope } from "../scope.js";
import {
  deriveProductContradictions,
  summarizeUnification,
} from "../../features/catalog/domain/catalogSummary.js";

const loadUnificacion = createCachedLoader(
  () => import("@data/source/unificacion.json"),
  (data) => data.default ?? data,
);

function requirePermission(session) {
  if (!can(session?.rol, "existencias", "ver")) {
    throw new Error("No tienes permiso para ver existencias");
  }
}

/**
 * Devuelve una copia independiente del informe de unificación.
 */
export async function getUnificacion(session) {
  requirePermission(session);
  const report = await loadUnificacion();

  const scope = getScope(session);
  const visibleBranches = scope.alcance === "todas"
    ? Object.keys(report.sucursales)
    : scope.alcance === "sucursal"
      ? [scope.idSucursal]
      : [];
  const products = report.productos.map((product) => {
    const porSucursal = Object.fromEntries(
      Object.entries(product.porSucursal)
        .filter(([branchId]) => visibleBranches.includes(branchId)),
    );
    return {
      ...product,
      porSucursal,
      contradicciones: deriveProductContradictions(Object.values(porSucursal)),
    };
  });
  const branches = Object.fromEntries(
    Object.entries(report.sucursales)
      .filter(([branchId]) => visibleBranches.includes(branchId)),
  );
  const canReview = scope.alcance === "todas"
    || can(session.rol, "existencias", "editar");
  const resumen = summarizeUnification(branches, products);
  return copy({
    ...report,
    meta: {
      ...report.meta,
      totalSucursales: Object.keys(branches).length,
      totalFilas: resumen.filasTotales,
    },
    sucursales: branches,
    productos: products,
    resumen,
    revision: canReview
      ? report.revision.filter((row) => visibleBranches.includes(row.sucursal))
      : [],
    puedeVerRevision: canReview,
  });
}

/**
 * Busca productos por clave, nombre de catálogo o cualquier nombre publicado.
 * @param {string} texto Texto libre de búsqueda.
 * @returns {Promise<Object[]>} Productos coincidentes como copias.
 */
export async function searchUnificacionProducts(texto, session) {
  const report = await getUnificacion(session);
  const query = normalizeName(texto);
  if (!query) return copy(report.productos);
  return copy(report.productos.filter((product) => {
    const names = [
      product.claveProducto,
      product.nombreCatalogo,
      ...Object.values(product.porSucursal).map((branch) => branch.nombrePublicado),
    ];
    return names.some((name) => normalizeName(name).includes(query));
  }));
}
