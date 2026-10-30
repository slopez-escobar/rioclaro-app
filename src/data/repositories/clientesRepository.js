import { can } from "../../features/auth/permissions.js";
import {
  canSeeCliente,
  getScope,
} from "../scope.js";
import {
  copy,
  createCachedLoader,
  groupBy,
  matchesText,
} from "./repositoryUtils.js";

const loadClientes = createCachedLoader(
  () => import("@data/source/clientes.json"),
  (data) => ({
    records: data.clientes,
    byId: new Map(data.clientes.map((cliente) => [cliente.idCliente, cliente])),
    bySucursal: groupBy(data.clientes, (cliente) => cliente.idSucursal),
  }),
);

function requirePermission(session) {
  if (!can(session?.rol, "clientes", "ver")) {
    throw new Error("No tienes permiso para ver clientes");
  }
}

function visibleClients(session, indexes) {
  const scope = getScope(session);
  if (scope.alcance === "todas") return indexes.records;
  if (scope.alcance === "sucursal") return indexes.bySucursal.get(scope.idSucursal) || [];
  const cliente = indexes.byId.get(scope.idCliente);
  return cliente && canSeeCliente(session, cliente) ? [cliente] : [];
}

/**
 * Lista copias de clientes visibles para la sesión y aplica los filtros después del alcance.
 */
export async function listClientes(session, filtros = {}) {
  requirePermission(session);
  const indexes = await loadClientes();
  const { estatus, idSucursal, tamano, tipo, texto } = filtros;
  return copy(visibleClients(session, indexes).filter((cliente) =>
    (estatus == null || cliente.estatus === estatus)
    && (idSucursal == null || cliente.idSucursal === idSucursal)
    && (tamano == null || cliente.tamano === tamano)
    && (tipo == null || cliente.tipoCliente === tipo)
    && matchesText(cliente, texto),
  ));
}

/**
 * Busca un cliente visible; devuelve null si no existe o está fuera del alcance.
 */
export async function getCliente(session, idCliente) {
  requirePermission(session);
  const indexes = await loadClientes();
  const cliente = indexes.byId.get(idCliente);
  return cliente && canSeeCliente(session, cliente) ? copy(cliente) : null;
}

/**
 * Obtiene el único cliente asociado a una sesión con alcance propio.
 */
export async function getMiCliente(session) {
  const scope = getScope(session);
  if (scope.alcance !== "propio" || !scope.idCliente) return null;
  const indexes = await loadClientes();
  const cliente = indexes.byId.get(scope.idCliente);
  return cliente && canSeeCliente(session, cliente) ? copy(cliente) : null;
}
