import { INVOICES_SCHEMA_VERSION, STORAGE_KEYS } from "../../config/constants.js";
import { localStore } from "../../shared/storage/localStore.js";
import { facturas as defaultSeed } from "../../data/source/seedInvoices.json";

const STORAGE_FULL_ERROR =
  "No se pudo guardar: el almacenamiento del navegador está lleno. Usa 'Restablecer demo'.";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function containsFileContent(value) {
  if (Array.isArray(value)) return value.some(containsFileContent);
  if (value === null || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) => {
    const tokens = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase().split(/[^a-z0-9]+/);
    return tokens.some((token) => ["base64", "blob", "contenido", "data"].includes(token))
      || containsFileContent(child);
  });
}

function assertMetadataOnly(record) {
  if (containsFileContent(record)) {
    throw new Error("No se permite guardar contenido de archivos en las facturas.");
  }
}

/**
 * Crea un repositorio versionado de facturas respaldado por un almacén compatible.
 * @param {Object} options Almacén y semilla de facturas.
 * @returns {Object} Operaciones de lectura y escritura de facturas.
 */
export function createInvoiceRepository({ store = localStore, seed = defaultSeed } = {}) {
  const safeSeed = clone(seed);

  function persist(items) {
    const nextState = { version: INVOICES_SCHEMA_VERSION, items: clone(items) };
    for (const invoice of nextState.items) assertMetadataOnly(invoice);
    const result = store.set(STORAGE_KEYS.invoices, nextState);
    if (result?.ok === false) {
      if (result.error === "cuota") throw new Error(STORAGE_FULL_ERROR);
      throw new Error("No se pudieron guardar las facturas.");
    }
    return nextState;
  }

  function getState() {
    const stored = store.get(STORAGE_KEYS.invoices, null);
    const isValid = stored
      && stored.version === INVOICES_SCHEMA_VERSION
      && Array.isArray(stored.items)
      && !stored.items.some(containsFileContent);
    if (!isValid) return persist(safeSeed);

    return { version: stored.version, items: clone(stored.items) };
  }

  function listInvoices() {
    return clone(getState().items)
      .sort((first, second) => String(second.subidaEn ?? "").localeCompare(String(first.subidaEn ?? "")));
  }

  return {
    /** Devuelve copias de las facturas ordenadas por fecha de subida descendente. */
    list: listInvoices,

    /** Busca una factura por identificador y devuelve una copia o null. */
    getById(id) {
      const invoice = getState().items.find((item) => item.id === id);
      return invoice ? clone(invoice) : null;
    },

    /** Agrega una factura de metadatos y devuelve una copia. */
    add(record) {
      assertMetadataOnly(record);
      const nextItems = [...getState().items, clone(record)];
      persist(nextItems);
      return clone(record);
    },

    /** Actualiza una factura con una función pura y devuelve el resultado. */
    update(id, updater) {
      if (typeof updater !== "function") {
        throw new Error("La actualización debe ser una función.");
      }
      const currentItems = getState().items;
      const index = currentItems.findIndex((item) => item.id === id);
      if (index === -1) throw new Error("La factura no existe");

      const updated = updater(clone(currentItems[index]));
      assertMetadataOnly(updated);
      const nextItems = clone(currentItems);
      nextItems[index] = { ...clone(updated), id };
      persist(nextItems);
      return clone(nextItems[index]);
    },

    /** Genera el siguiente identificador FAC con cuatro dígitos como mínimo. */
    nextId() {
      const maximum = getState().items.reduce((max, invoice) => {
        const match = /^FAC-(\d+)$/i.exec(invoice.id ?? "");
        return match ? Math.max(max, Number(match[1])) : max;
      }, 0);
      return `FAC-${String(maximum + 1).padStart(4, "0")}`;
    },

    /** Restaura la semilla inicial y descarta las modificaciones de la demo. */
    reset() {
      persist(safeSeed);
      return listInvoices();
    },
  };
}

/** Repositorio de facturas de la aplicación con el almacén y la semilla reales. */
export const invoiceRepository = createInvoiceRepository();
