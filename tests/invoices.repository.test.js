import { describe, expect, it } from "vitest";
import { INVOICES_SCHEMA_VERSION, STORAGE_KEYS } from "../src/config/constants.js";
import {
  createInvoiceRepository,
  invoiceRepository,
} from "../src/features/invoices/invoiceRepository.js";
import {
  findByRfc,
  listProveedores,
} from "../src/data/repositories/proveedoresRepository.js";
import { facturas as seed } from "../src/data/source/seedInvoices.json";

function createMemoryStore(initial = null, { quota = false } = {}) {
  const values = new Map();
  if (initial !== null) values.set(STORAGE_KEYS.invoices, initial);
  return {
    get(key, fallback = null) {
      return values.has(key) ? values.get(key) : fallback;
    },
    set(key, value) {
      if (quota) return { ok: false, error: "cuota" };
      values.set(key, structuredClone(value));
      return { ok: true };
    },
    remove(key) {
      values.delete(key);
    },
    values,
  };
}

function invoice(id, subidaEn, extra = {}) {
  return {
    id,
    archivo: `${id}.pdf`,
    subidaEn,
    estado: "OK",
    motivos: [],
    aprobaciones: [],
    historial: [],
    ...extra,
  };
}

describe("repositorio de facturas", () => {
  it("carga y persiste la semilla durante la primera lectura", () => {
    const store = createMemoryStore();
    const repository = createInvoiceRepository({ store, seed });

    expect(repository.list()).toHaveLength(9);
    expect(store.get(STORAGE_KEYS.invoices)).toEqual({
      version: INVOICES_SCHEMA_VERSION,
      items: seed,
    });
  });

  it("conserva los datos al crear otra instancia del repositorio", () => {
    const store = createMemoryStore();
    const first = createInvoiceRepository({ store, seed: [] });
    first.add(invoice("FAC-0010", "2026-10-25T10:00:00Z"));

    const second = createInvoiceRepository({ store, seed });
    expect(second.getById("FAC-0010")).toMatchObject({ id: "FAC-0010" });
    expect(second.list()).toHaveLength(1);
  });

  it("agrega y recupera copias", () => {
    const repository = createInvoiceRepository({ store: createMemoryStore(), seed: [] });
    const record = invoice("FAC-0001", "2026-10-25T10:00:00Z");
    const added = repository.add(record);

    expect(added).toEqual(record);
    expect(repository.getById("FAC-0001")).toEqual(record);
    expect(repository.getById("inexistente")).toBeNull();
    expect(added).not.toBe(record);
  });

  it("actualiza sin mutar el objeto del updater y falla si la factura no existe", () => {
    const repository = createInvoiceRepository({ store: createMemoryStore(), seed: [] });
    repository.add(invoice("FAC-0001", "2026-10-25T10:00:00Z"));
    const updated = repository.update("FAC-0001", (current) => ({
      ...current,
      estado: "Aprobada",
    }));

    expect(updated).toMatchObject({ id: "FAC-0001", estado: "Aprobada" });
    expect(() => repository.update("FAC-9999", (current) => current)).toThrow(
      "La factura no existe",
    );
  });

  it("genera el siguiente identificador desde una semilla vacía y con registros", () => {
    const empty = createInvoiceRepository({ store: createMemoryStore(), seed: [] });
    expect(empty.nextId()).toBe("FAC-0001");

    const populated = createInvoiceRepository({ store: createMemoryStore(), seed });
    expect(populated.nextId()).toBe("FAC-0010");
    populated.add(invoice("FAC-0100", "2026-10-25T10:00:00Z"));
    expect(populated.nextId()).toBe("FAC-0101");
  });

  it("restablece la semilla", () => {
    const repository = createInvoiceRepository({ store: createMemoryStore(), seed });
    repository.add(invoice("FAC-0010", "2026-10-26T10:00:00Z"));
    const reset = repository.reset;
    const restored = reset();

    expect(restored).toHaveLength(9);
    expect(restored.some((record) => record.id === "FAC-0010")).toBe(false);
    expect(restored).toEqual(repository.list());
  });

  it.each([
    ["JSON dañado", "{invalid json"],
    ["versión distinta", { version: INVOICES_SCHEMA_VERSION + 1, items: [invoice("FAC-0099", "2026-10-25")] }],
  ])("restaura la semilla cuando encuentra %s", (_description, initial) => {
    const repository = createInvoiceRepository({
      store: createMemoryStore(initial),
      seed,
    });

    expect(repository.list()).toHaveLength(9);
    expect(repository.getById("FAC-0099")).toBeNull();
  });

  it("traduce el error de cuota al mensaje de recuperación indicado", () => {
    const repository = createInvoiceRepository({
      store: createMemoryStore(null, { quota: true }),
      seed: [],
    });

    expect(() => repository.add(invoice("FAC-0001", "2026-10-25"))).toThrow(
      "No se pudo guardar: el almacenamiento del navegador está lleno. Usa 'Restablecer demo'.",
    );
  });

  it("ordena por subidaEn descendente", () => {
    const repository = createInvoiceRepository({
      store: createMemoryStore(),
      seed: [
        invoice("FAC-0001", "2026-10-20T10:00:00Z"),
        invoice("FAC-0002", "2026-10-25T10:00:00Z"),
        invoice("FAC-0003", "2026-10-22T10:00:00Z"),
      ],
    });

    expect(repository.list().map((record) => record.id)).toEqual([
      "FAC-0002",
      "FAC-0003",
      "FAC-0001",
    ]);
  });

  it.each(["base64", "blob", "contenidoArchivo", "data"])(
    "rechaza registros que contienen el campo %s",
    (field) => {
      const repository = createInvoiceRepository({ store: createMemoryStore(), seed: [] });
      expect(() =>
        repository.add(invoice("FAC-0001", "2026-10-25", { [field]: "contenido binario" })),
      ).toThrow("No se permite guardar contenido de archivos en las facturas.");
    },
  );

  it("devuelve copias que no pueden mutar el estado interno", () => {
    const repository = createInvoiceRepository({ store: createMemoryStore(), seed });
    const listed = repository.list();
    listed[0].estado = "Alterada";
    listed[0].motivos.push("cambio externo");

    const loaded = repository.getById(listed[0].id);
    loaded.estado = "También alterada";
    expect(repository.getById(listed[0].id).estado).toBe(
      seed.find((record) => record.id === listed[0].id).estado,
    );
    expect(repository.getById(listed[0].id).motivos).toEqual(
      seed.find((record) => record.id === listed[0].id).motivos,
    );
    expect(invoiceRepository).toBeDefined();
  });
});

describe("repositorio de proveedores", () => {
  it("carga de forma diferida el catálogo de 60 proveedores", async () => {
    expect(await listProveedores()).toHaveLength(60);
  });

  it("busca por RFC con espacios y minúsculas", async () => {
    const result = await findByRfc("  dbx-0909164xs  ");

    expect(result).toMatchObject({
      idProveedor: "PRV-002",
      rfc: "DBX0909164XS",
      razonSocial: "Desechables Beltrán S. de R.L. de C.V.",
    });
    expect(await findByRfc("RFC-INEXISTENTE")).toBeNull();
  });
});
