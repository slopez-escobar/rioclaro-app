import { describe, expect, it } from "vitest";
import {
  extractSize,
  inferBranchConventions,
  matchProduct,
  normalizeName,
  parsePrice,
} from "../src/features/catalog/domain/catalogMatching.js";
import { productos } from "../src/data/source/catalogo-productos.json";

const find = (name) => matchProduct({ nombrePublicado: name }, productos);

describe("normalización de nombres de sucursal", () => {
  it.each([
    ["CLORO LITRO", "cloro 1 litro"],
    ["Cloro 1L", "cloro 1 litro"],
    ["Blanqueador 1000ml", "cloro 1 litro"],
    ["Cloro Blanqueador 1 Lt", "cloro cloro 1 litro"],
    ["Cloro (litro)", "cloro 1 litro"],
    ["CLORO GALON", "cloro 4 litros"],
    ["Cloro 4L", "cloro 4 litros"],
    ["Blanqueador 4L", "cloro 4 litros"],
    ["Cloro Blanqueador 4 Lt", "cloro cloro 4 litros"],
    ["Cloro (galón)", "cloro 4 litros"],
    ["  Cloro    1  lt.  ", "cloro 1 litro"],
  ])("normaliza %s", (source, expected) => {
    expect(normalizeName(source)).toBe(expected);
  });

  it("aplica sinónimos de términos del catálogo", () => {
    expect(normalizeName("Papel de baño 12 Rll")).toBe("papel higienico 12 rollos");
    expect(normalizeName("Toalla Z")).toBe("toalla interdoblada");
    expect(normalizeName("Limpiador multiusos")).toBe("desinfectante multiusos");
    expect(normalizeName("BOLSA P/BASURA 25 PZAS")).toBe("bolsa para basura 25 piezas");
  });

  it("extrae medidas canónicas", () => {
    expect(extractSize("Cloro 1000ml")).toEqual({ cantidad: 1, unidad: "litro" });
    expect(extractSize("Blanqueador (galón)")).toEqual({ cantidad: 4, unidad: "litros" });
    expect(extractSize("Papel higiénico 12 rollos")).toEqual({ cantidad: 12, unidad: "rollos" });
    expect(extractSize("Producto sin presentación")).toBeNull();
  });
});

describe("coincidencia con el catálogo", () => {
  it.each([
    "CLORO LITRO",
    "Cloro 1L",
    "Blanqueador 1000ml",
    "Cloro Blanqueador 1 Lt",
    "Cloro (litro)",
  ])("resuelve la presentación de un litro: %s", (name) => {
    expect(find(name)).toMatchObject({ clave: "CLO-1L" });
  });

  it.each([
    "CLORO GALON",
    "Cloro 4L",
    "Blanqueador 4L",
    "Cloro Blanqueador 4 Lt",
    "Cloro (galón)",
  ])("resuelve la presentación de cuatro litros: %s", (name) => {
    expect(find(name)).toMatchObject({ clave: "CLO-4L" });
  });

  it("nunca mezcla presentaciones de uno y cuatro litros", () => {
    expect(find("Cloro 1L").clave).toBe("CLO-1L");
    expect(find("Cloro 4L").clave).toBe("CLO-4L");
    expect(find("Cloro 1000 ml").clave).not.toBe("CLO-4L");
    expect(find("Cloro 4 litros").clave).not.toBe("CLO-1L");
  });

  it("deja en revisión un nombre inexistente y un empate", () => {
    expect(find("Producto inexistente 777 unidades")).toMatchObject({
      clave: null,
      estado: "Revisar",
    });
    const tiedCatalog = [
      { claveProducto: "A", nombre: "Producto Alfa", alias: ["Disputado"] },
      { claveProducto: "B", nombre: "Producto Beta", alias: ["Disputado"] },
    ];
    expect(matchProduct({ nombrePublicado: "Disputado" }, tiedCatalog)).toMatchObject({
      clave: null,
      estado: "Revisar",
    });
  });
});

describe("precios y convenciones de sucursal", () => {
  it.each([
    ["$18.50", 18.5],
    ["1,450.00", 1450],
    ["texto", null],
    ["$-", null],
    [-1, null],
  ])("parsea el precio %s", (value, expected) => {
    expect(parsePrice(value)).toBe(expected);
  });

  it("infiere IVA y existencia física o disponible con los datos de referencia", () => {
    const product = productos.find((item) => item.claveProducto === "CLO-1L");
    const reference = [
      { claveProducto: "CLO-1L", idSucursal: "zap", existencia: 180, disponible: 170 },
      { claveProducto: "CLO-1L", idSucursal: "gdl", existencia: 240, disponible: 203 },
    ];
    expect(inferBranchConventions([
      { clave: "CLO-1L", sucursal: "zap", precioPublicado: 21.46, existenciaPublicada: 180 },
    ], [product], reference)).toEqual({
      factorPrecio: 1.16,
      precioIncluyeIVA: true,
      existenciaSignifica: "fisica",
    });
    expect(inferBranchConventions([
      { clave: "CLO-1L", sucursal: "gdl", precioPublicado: 18.5, existenciaPublicada: 203 },
    ], [product], reference)).toEqual({
      factorPrecio: 1,
      precioIncluyeIVA: false,
      existenciaSignifica: "disponible",
    });
    expect(inferBranchConventions([
      { clave: "CLO-1L", sucursal: "zap", precioPublicado: 18.5, existenciaPublicada: 180 },
    ], [product], [
      { claveProducto: "CLO-1L", idSucursal: "zap", existencia: 180, disponible: 180 },
    ])).toMatchObject({ existenciaSignifica: "indeterminado" });
  });
});
