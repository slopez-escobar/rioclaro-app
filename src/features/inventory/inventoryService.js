import {
  getAliasIndex,
  listProductos,
} from "../../data/repositories/catalogoRepository.js";
import {
  getExistenciasMeta,
  listExistencias,
} from "../../data/repositories/existenciasRepository.js";
import { listSucursales } from "../../data/repositories/sucursalesRepository.js";
import {
  groupByProduct,
  matchesInventoryFilters,
  resolveProductQuery,
} from "./domain/index.js";

function resolveFilters(texto, catalogo, aliasIndex, filters) {
  return {
    ...filters,
    texto: texto ? resolveProductQuery(texto, catalogo, aliasIndex) : null,
  };
}

function countStatuses(records) {
  return records.reduce((counts, record) => {
    counts[record.estatusStock] = (counts[record.estatusStock] || 0) + 1;
    return counts;
  }, { agotado: 0, bajo: 0, normal: 0, exceso: 0 });
}

export const inventoryService = createInventoryService({
  existenciasRepo: { listExistencias, getExistenciasMeta },
  catalogoRepo: { listProductos, getAliasIndex },
  sucursalesRepo: { listSucursales },
});

/**
 * Crea el servicio de consultas de existencias con dependencias sustituibles en pruebas.
 */
export function createInventoryService({
  existenciasRepo,
  catalogoRepo,
  sucursalesRepo,
}) {
  async function getInventory(session) {
    const [registros, catalogo, aliasIndex, meta] = await Promise.all([
      existenciasRepo.listExistencias(session),
      catalogoRepo.listProductos(),
      catalogoRepo.getAliasIndex(),
      existenciasRepo.getExistenciasMeta(),
    ]);
    const filas = groupByProduct(registros, catalogo);
    const ids = new Set(registros.map((record) => record.idSucursal));
    const sucursales = sucursalesRepo.listSucursales()
      .filter((branch) => ids.has(branch.id));
    return { registros, catalogo, aliasIndex, meta, filas, sucursales };
  }

  return {
    async list(session, filtros = {}, { page = 1, pageSize = 20 } = {}) {
      const { registros, catalogo, aliasIndex, meta, filas, sucursales } =
        await getInventory(session);
      const resolved = resolveFilters(filtros.texto, catalogo, aliasIndex, filtros);
      const filtered = filas
        .filter((row) => matchesInventoryFilters(row, resolved))
        .sort((left, right) => left.nombre.localeCompare(right.nombre, "es-MX"));
      const safePageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 20;
      const pageCount = Math.max(1, Math.ceil(filtered.length / safePageSize));
      const safePage = Number.isInteger(page) ? Math.min(Math.max(page, 1), pageCount) : 1;
      const start = (safePage - 1) * safePageSize;
      return {
        filas: filtered.slice(start, start + safePageSize),
        total: filtered.length,
        page: safePage,
        pageSize: safePageSize,
        pageCount,
        alcance: session.alcance,
        sucursales,
        categorias: [...new Set(catalogo.map((product) => product.categoria))]
          .sort((left, right) => left.localeCompare(right, "es-MX")),
        fechaCorte: meta.fechaCorte,
        registrosVisibles: registros.length,
      };
    },

    async getProduct(session, clave) {
      const { registros, catalogo, sucursales } = await getInventory(session);
      const producto = catalogo.find((item) => item.claveProducto === clave);
      const branchById = new Map(sucursales.map((branch) => [branch.id, branch]));
      const visibles = registros
        .filter((record) => record.claveProducto === clave)
        .map((record) => ({
          ...record,
          sucursal: branchById.get(record.idSucursal)?.ciudad
            || branchById.get(record.idSucursal)?.nombre
            || record.idSucursal,
        }));
      if (!producto || !visibles.length) return null;
      return { ...producto, registros: visibles };
    },

    async summary(session) {
      const { registros, filas, meta } = await getInventory(session);
      const statuses = countStatuses(registros);
      return {
        productos: filas.length,
        registros: registros.length,
        agotados: statuses.agotado,
        bajos: statuses.bajo,
        normales: statuses.normal,
        exceso: statuses.exceso,
        fechaCorte: meta.fechaCorte,
      };
    },

    async getMeta() {
      return existenciasRepo.getExistenciasMeta();
    },
  };
}
