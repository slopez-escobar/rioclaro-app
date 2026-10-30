import { describe, expect, it } from "vitest";
import {
  formatReconciliationBreakdown,
  formatSalesPeriod,
  salesPercentage,
} from "../src/features/sales/salesFormat.js";

describe("formato del reporte de ventas", () => {
  it("presenta periodos cronológicos en español", () => {
    expect(formatSalesPeriod("2026-09")).toBe("septiembre de 2026");
    expect(formatSalesPeriod("2026-13")).toBe("2026-13");
  });

  it("limita porcentajes a un total válido", () => {
    expect(salesPercentage(25, 100)).toBe(25);
    expect(salesPercentage(1, 0)).toBe(0);
    expect(salesPercentage(150, 100)).toBe(100);
  });

  it("explica diferencias de cancelados y devoluciones con importes", () => {
    expect(formatReconciliationBreakdown(
      "incluye_cancelados",
      { canceladosIncluidos: 181981.2 },
    )).toContain("$181,981.20");
    expect(formatReconciliationBreakdown(
      "incluye_devueltos",
      { devolucionesIncluidas: 31574.76 },
    )).toContain("$31,574.76");
    expect(formatReconciliationBreakdown("con_iva", { ivaDeProductos: 105313.34 }))
      .toContain("$105,313.34");
    expect(formatReconciliationBreakdown("por_fecha_de_entrega", {
      entregadosEnElPeriodoDePedidosDeOtroMes: 1938,
      pedidosDelPeriodoNoEntregadosEnElPeriodo: 182687.86,
    })).toContain("$182,687.86");
    expect(formatReconciliationBreakdown("por_sucursal_que_surte", {
      ventasDeOtrasSucursalesSurtidasPorEstaSucursal: 152060,
      ventasDeEstaSucursalSurtidasPorOtras: 39052.84,
    })).toContain("$39,052.84");
  });
});
