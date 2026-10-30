import { describe, expect, it } from "vitest";
import { usuarios } from "../src/features/auth/data/usuarios.json";
import { listExistencias } from "../src/data/repositories/existenciasRepository.js";
import { inventoryService } from "../src/features/inventory/inventoryService.js";
import { sessionFor } from "./chatTestUtils.js";

describe("servicio de existencias", () => {
  it("resume productos y estatus por registro para dirección", async () => {
    const summary = await inventoryService.summary(sessionFor("ernesto"));

    expect(summary).toEqual({
      productos: 64,
      registros: 320,
      agotados: 21,
      bajos: 41,
      normales: 180,
      exceso: 78,
      fechaCorte: "2026-10-23 12:00",
    });
  }, 20_000);

  it("muestra la existencia física, comprometida y disponible de Toño", async () => {
    const session = sessionFor("tono");
    const result = await inventoryService.list(session);
    const [cloro] = (await inventoryService.list(session, { texto: "cloro litro" })).filas;

    expect(result).toMatchObject({
      total: 64,
      page: 1,
      pageSize: 20,
      pageCount: 4,
      alcance: "sucursal",
    });
    expect(result.sucursales.map((branch) => branch.id)).toEqual(["gdl"]);
    expect(cloro).toMatchObject({
      claveProducto: "CLO-1L",
      sucursales: {
        gdl: { existencia: 240, comprometido: 37, disponible: 203 },
      },
    });
    for (const text of ["Blanqueador 1000ml", "CLORO LITRO"]) {
      const [match] = (await inventoryService.list(session, { texto: text })).filas;
      expect(match.claveProducto).toBe("CLO-1L");
    }
    expect((await inventoryService.list(session, { texto: "cloro" })).filas.map((row) => row.claveProducto).sort())
      .toEqual(["CLO-1L", "CLO-20L", "CLO-4L"]);
  }, 20_000);

  it("limita resultados y detalle a la sucursal visible y no amplía con filtros", async () => {
    const session = sessionFor("mariana");
    const result = await inventoryService.list(session, { idSucursal: "qro" });
    const product = await inventoryService.getProduct(session, "CLO-1L");

    expect(result.total).toBe(0);
    expect(result.sucursales.map((branch) => branch.id)).toEqual(["leo"]);
    expect(product.registros.map((record) => record.idSucursal)).toEqual(["leo"]);
    expect(product.registros[0].sucursal).toBe("León");
  }, 20_000);

  it("permite el alcance global a Compras y pagina en grupos de veinte", async () => {
    const result = await inventoryService.list(sessionFor("yesenia.flores"));
    const agotados = await inventoryService.list(sessionFor("yesenia.flores"), { estatus: "agotado" });
    const bajos = await inventoryService.list(sessionFor("yesenia.flores"), { estatus: "bajo" });

    expect(result).toMatchObject({ total: 64, registrosVisibles: 320, pageSize: 20, pageCount: 4, alcance: "todas" });
    expect(result.sucursales).toHaveLength(5);
    expect(agotados.filas.every((row) =>
      Object.values(row.sucursales).some((record) => record.estatusStock === "agotado"),
    )).toBe(true);
    expect(bajos.filas.every((row) =>
      Object.values(row.sucursales).some((record) => record.estatusStock === "bajo"),
    )).toBe(true);
    const secondPage = await inventoryService.list(sessionFor("yesenia.flores"), {}, { page: 2 });
    expect(secondPage.filas).toHaveLength(20);
    expect(secondPage.filas[0].claveProducto).not.toBe(result.filas[0].claveProducto);
  }, 20_000);

  it("aplica las reglas de permiso reales para todos los roles", async () => {
    const withoutPermission = new Set([
      "finanzas",
      "rh",
      "administrador_ti",
      "reparto",
      "administrativo",
      "cliente",
    ]);
    const sessionsByRole = new Map([
      ["direccion", "ernesto"],
      ["compras", "yesenia.flores"],
      ["gerente_sucursal", "mariana"],
      ["ventas", usuarios.find((user) => user.rol === "ventas" && user.idSucursal === "leo")?.usuario],
      ["bodega", "tono"],
      ["finanzas", "laura"],
      ["administrador_ti", "carlos"],
      ["cliente", "cliente1"],
      ["rh", usuarios.find((user) => user.rol === "rh")?.usuario],
      ["reparto", usuarios.find((user) => user.rol === "reparto")?.usuario],
      ["administrativo", usuarios.find((user) => user.rol === "administrativo")?.usuario],
    ]);

    for (const [role, username] of sessionsByRole) {
      expect(username).toBeTruthy();
      if (withoutPermission.has(role)) {
        await expect(inventoryService.list(sessionFor(username)))
          .rejects.toThrow("No tienes permiso para ver existencias");
      } else {
        expect((await inventoryService.list(sessionFor(username))).total).toBeGreaterThan(0);
      }
    }
  }, 30_000);

  it("distribuye el disponible conforme a existencia menos comprometido", async () => {
    const session = sessionFor("ernesto");
    const rows = await listExistencias(session);
    for (const record of rows) {
      expect(record.disponible, `${record.claveProducto}/${record.idSucursal}`)
        .toBe(record.existencia - record.comprometido);
    }
  }, 20_000);

  it("devuelve null si el producto no tiene ningún registro visible", async () => {
    expect(await inventoryService.getProduct(sessionFor("tono"), "INVALIDO")).toBeNull();
  }, 20_000);
});
