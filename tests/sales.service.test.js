import { describe, expect, it } from "vitest";
import { sessionFor } from "./chatTestUtils.js";
import { salesService } from "../src/features/sales/salesService.js";
import { can } from "../src/features/auth/permissions.js";
import { createConciliationLoader } from "../src/data/repositories/ventasConciliacionRepository.js";

describe("servicio de ventas", () => {
  it("da a dirección el reporte completo y concilia septiembre", async () => {
    const session = sessionFor("ernesto");
    const complete = await salesService.getReport(session);
    expect(complete.totales.netas.pedidos).toBe(2690);
    expect(complete.totales.confirmadas.total).toBe(25923646.37);
    expect(complete.totales.canceladas.total).toBe(1717143.97);
    expect(complete.periodosDisponibles).toContain("2026-09");
    const leadingProducts = Object.entries(complete.porProducto)
      .sort((left, right) => right[1].importe - left[1].importe)
      .slice(0, 5)
      .map(([clave, producto]) => [clave, producto.importe, producto.nombre]);
    expect(leadingProducts).toEqual([
      ["TIN-CJ", 1436836.80, "Toalla interdoblada caja con 20 paquetes"],
      ["DET-20K", 1019110.40, "Detergente en polvo 20 kg"],
      ["STR-45", 924640, "Película stretch"],
      ["SUA-5L", 813030, "Suavizante de telas 5 litros"],
      ["FRA-1L", 665254.60, "Fragancia concentrada 1 litro"],
    ]);

    const september = await salesService.getReport(session, { periodo: "2026-09" });
    expect(september.totales.netas.productos).toBe(4104680.26);
    expect(september.reconciliacion.sumaSucursalesIgualTotal).toBe(true);
    expect(september.surtidasParaOtras).toBeNull();
  }, 20_000);

  it("limita a Mariana a sus ventas y a la fila de conciliación de León", async () => {
    const session = sessionFor("mariana");
    const report = await salesService.getReport(session);
    expect(Object.keys(report.porSucursal)).toEqual(["leo"]);
    expect(report.porSucursal.leo).toMatchObject({
      productos: 3339117.82,
      pedidos: 450,
    });
    expect(report.surtidasParaOtras).toMatchObject({
      pedidos: expect.any(Number),
      productos: expect.any(Number),
    });
    expect(Object.keys(report.surtidasParaOtras.porSucursal))
      .not.toContain("leo");

    const filtered = await salesService.getReport(session, { idSucursal: "qro" });
    expect(Object.keys(filtered.porSucursal)).toEqual(["leo"]);

    const reconciliation = await salesService.getReconciliation(session);
    expect(reconciliation.sucursales).toHaveLength(1);
    expect(reconciliation.sucursales[0].id).toBe("leo");
    expect(reconciliation.resumen).toBeNull();
  }, 20_000);

  it("solo incluye dimensiones de clientes cuando el rol puede consultarlos", async () => {
    const laura = sessionFor("laura");
    expect(can(laura.rol, "clientes", "ver")).toBe(true);
    const report = await salesService.getReport(laura);
    expect(report.porTipoCliente).not.toBeNull();
    expect(report.porTamano).not.toBeNull();
  }, 20_000);

  it.each(["tono", "yesenia.flores", "carlos", "cliente1"])(
    "rechaza el reporte para %s",
    async (username) => {
      await expect(salesService.getReport(sessionFor(username)))
        .rejects.toThrowError("No tienes permiso para ver el reporte de ventas");
      await expect(salesService.getReconciliation(sessionFor(username)))
        .rejects.toThrowError("No tienes permiso para ver el reporte de ventas");
    },
  );

  it("no conserva errores de carga en la caché de conciliación", async () => {
    let attempts = 0;
    const load = createConciliationLoader(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("falla temporal");
      return { default: { sucursales: [] } };
    });
    await expect(load()).rejects.toThrow(
      "No se pudo cargar la conciliación de ventas. Ejecuta npm run ventas:conciliar y recarga la página.",
    );
    await expect(load()).resolves.toEqual({ sucursales: [] });
    await expect(load()).resolves.toEqual({ sucursales: [] });
    expect(attempts).toBe(2);
  });
});
