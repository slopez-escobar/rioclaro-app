import { can } from "../../features/auth/permissions.js";
import { canSeeQueja, getScope } from "../scope.js";
import {
  copy,
  createCachedLoader,
  groupBy,
  matchesText,
} from "./repositoryUtils.js";

const loadQuejas = createCachedLoader(
  () => import("@data/source/quejas.json"),
  (data) => ({
    records: data.quejas,
    meta: data.meta,
    byId: new Map(data.quejas.map((queja) => [queja.idQueja, queja])),
    byCliente: groupBy(data.quejas, (queja) => queja.idCliente),
    bySucursal: groupBy(data.quejas, (queja) => queja.idSucursal),
    bySucursalSurtido: groupBy(data.quejas, (queja) => queja.idSucursalSurtido),
  }),
);

function requirePermission(session) {
  if (!can(session?.rol, "quejas", "ver")) {
    throw new Error("No tienes permiso para ver quejas");
  }
}

function visibleComplaints(session, indexes) {
  const scope = getScope(session);
  if (scope.alcance === "todas") return indexes.records;
  if (scope.alcance === "propio") return indexes.byCliente.get(scope.idCliente) || [];
  const complaints = new Set([
    ...(indexes.bySucursal.get(scope.idSucursal) || []),
    ...(indexes.bySucursalSurtido.get(scope.idSucursal) || []),
  ]);
  return [...complaints];
}

/**
 * Lista copias de quejas base visibles para la sesión y aplica los filtros después del alcance.
 */
export async function listQuejas(session, filtros = {}) {
  requirePermission(session);
  const indexes = await loadQuejas();
  const { estatus, idSucursal, idCliente, tema, prioridad, desde, hasta, texto } = filtros;
  return copy(visibleComplaints(session, indexes).filter((queja) => {
    const fecha = String(queja.fechaQueja || "").slice(0, 10);
    const coincideSucursal = idSucursal == null
      || queja.idSucursal === idSucursal
      || queja.idSucursalSurtido === idSucursal;
    return (estatus == null || queja.estatus === estatus)
      && coincideSucursal
      && (idCliente == null || queja.idCliente === idCliente)
      && (tema == null || queja.tema === tema)
      && (prioridad == null || queja.prioridad === prioridad)
      && (desde == null || fecha >= desde)
      && (hasta == null || fecha <= hasta)
      && matchesText(queja, texto);
  }));
}

/**
 * Busca una queja base visible; devuelve null si no existe o está fuera del alcance.
 */
export async function getQueja(session, idQueja) {
  requirePermission(session);
  const indexes = await loadQuejas();
  const queja = indexes.byId.get(idQueja);
  return queja && canSeeQueja(session, queja) ? copy(queja) : null;
}

/**
 * Devuelve el total de quejas base, sin filtrar ni exponer sus registros.
 * @returns {Promise<number>} Total de quejas históricas.
 */
export async function getBaseCount() {
  return (await loadQuejas()).records.length;
}
