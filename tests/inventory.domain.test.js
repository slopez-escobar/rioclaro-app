import { describe, expect, it } from "vitest";
import {
  ESTATUS_LABEL,
  ESTATUS_ORDEN,
  ESTATUS_VARIANT,
  groupByProduct,
  matchesInventoryFilters,
  resolveProductQuery,
} from "../src/features/inventory/domain/index.js";
import { getAliasIndex, listProductos } from "../src/data/repositories/catalogoRepository.js";
import { normalizeName } from "../src/features/catalog/domain/catalogMatching.js";

describe("dominio de existencias", () => {
  it.each([
    ["CLORO LITRO", ["CLO-1L"]],
    ["Cloro 1L", ["CLO-1L"]],
    ["Blanqueador 1000ml", ["CLO-1L"]],
    ["Cloro Blanqueador 1 Lt", ["CLO-1L"]],
    ["Cloro (litro)", ["CLO-1L"]],
    ["CLO-1L", ["CLO-1L"]],
    ["cloro", ["CLO-1L", "CLO-20L", "CLO-4L"]],
    ["blanqueador 4L", ["CLO-4L"]],
    ["producto inexistente", []],
  ])("resuelve %s sin confundir presentaciones", async (text, expected) => {
    const [catalog, aliasIndex] = await Promise.all([listProductos(), getAliasIndex()]);
    expect(resolveProductQuery(text, catalog, aliasIndex).claves).toEqual(expected);
  });

  it("reporta el método utilizado para resolver la consulta", async () => {
    const catalog = await listProductos();
    const aliases = await getAliasIndex();
    expect(resolveProductQuery("CLO-1L", catalog, aliases).metodo).toBe("clave");
    expect(resolveProductQuery("CLORO LITRO", catalog, aliases).metodo).toBe("alias");
    expect(resolveProductQuery("cloro", catalog, aliases).metodo).toBe("contiene");
    expect(resolveProductQuery("producto inexistente", catalog, aliases).metodo).toBe("ninguno");
  });

  it("agrupa registros visibles y suma totales por producto", async () => {
    const catalog = await listProductos();
    const product = catalog.find((item) => item.claveProducto === "CLO-1L");
    const records = [
      { claveProducto: product.claveProducto, idSucursal: "gdl", existencia: 240, comprometido: 37, disponible: 203, estatusStock: "exceso" },
      { claveProducto: product.claveProducto, idSucursal: "leo", existencia: 10, comprometido: 2, disponible: 8, estatusStock: "bajo" },
    ];
    const [row] = groupByProduct(records, catalog);

    expect(row).toMatchObject({
      claveProducto: "CLO-1L",
      nombre: product.nombre,
      totales: { existencia: 250, comprometido: 39, disponible: 211 },
      peorEstatus: "bajo",
    });
    expect(Object.keys(row.sucursales)).toEqual(["gdl", "leo"]);
  });

  it("filtra por productos resueltos, categoría, estatus y sucursal", async () => {
    const catalog = await listProductos();
    const row = groupByProduct([
      { claveProducto: "CLO-1L", idSucursal: "gdl", existencia: 240, comprometido: 37, disponible: 203, estatusStock: "exceso" },
      { claveProducto: "CLO-1L", idSucursal: "leo", existencia: 10, comprometido: 2, disponible: 8, estatusStock: "bajo" },
    ], catalog)[0];
    const cloroQuery = { claves: ["CLO-1L"], metodo: "alias" };

    expect(matchesInventoryFilters(row, { texto: cloroQuery })).toBe(true);
    expect(matchesInventoryFilters(row, { estatus: "bajo" })).toBe(true);
    expect(matchesInventoryFilters(row, { estatus: "bajo", idSucursal: "gdl" })).toBe(false);
    expect(matchesInventoryFilters(row, { idSucursal: "qro" })).toBe(false);
    expect(matchesInventoryFilters(row, { categoria: "Otra categoría" })).toBe(false);
    expect(matchesInventoryFilters(row, { texto: { claves: [], metodo: "ninguno" } })).toBe(false);
  });

  it("define etiquetas, símbolos, variantes y orden de estatus", () => {
    expect(ESTATUS_LABEL).toEqual({
      agotado: "Agotado",
      bajo: "Stock bajo",
      normal: "Normal",
      exceso: "Exceso",
    });
    expect(ESTATUS_VARIANT).toMatchObject({
      agotado: { symbol: "×" },
      bajo: { symbol: "!" },
      normal: { symbol: "✓" },
      exceso: { symbol: "↑" },
    });
    expect(ESTATUS_ORDEN).toEqual(["agotado", "bajo", "normal", "exceso"]);
  });

  it("usa la normalización de catálogo para las consultas de alias", () => {
    expect(normalizeName("Blanqueador 1000ml")).toBe("cloro 1 litro");
  });
});
