import { describe, expect, it } from "vitest";
import { pedidos } from "../src/data/source/pedidos.json";
import {
  buildSalesReport,
  classifyOrder,
  inPeriod,
  reconcileReport,
  saleAmounts,
} from "../src/features/sales/domain/index.js";
import { clientes } from "../src/data/source/clientes.json";

const BRANCH_PRODUCTS = {
  gdl: 8271777.62,
  zap: 3715100.68,
  leo: 3339117.82,
  qro: 3673944.86,
  ags: 2550772.66,
};

describe("reglas puras de ventas", () => {
  it("clasifica los ocho estados de pedido", () => {
    for (const estado of [
      "pendiente_confirmacion",
      "aceptado",
      "en_preparacion",
      "listo_para_recoger",
      "en_ruta",
      "entregado",
    ]) {
      expect(classifyOrder({ estado })).toBe("neta");
    }
    expect(classifyOrder({ estado: "cancelado" })).toBe("cancelado");
    expect(classifyOrder({ estado: "devuelto" })).toBe("devuelto");
  });

  it("separa los importes del resumen y reconoce el periodo AAAA-MM", () => {
    expect(saleAmounts(pedidos[0])).toEqual({
      productos: 85,
      envio: 150,
      iva: 37.6,
      total: 272.6,
    });
    expect(inPeriod("2026-09-30T23:59", "2026-09")).toBe(true);
    expect(inPeriod("2026-10-01", "2026-09")).toBe(false);
    expect(inPeriod("2026-09-01", "2026-9")).toBe(false);
  });

  it("concilia los importes netos reales de los 3,000 pedidos", () => {
    const report = buildSalesReport(pedidos);
    expect(report.totales).toMatchObject({
      netas: {
        pedidos: 2690,
        productos: 21550713.64,
        envio: 134850,
        iva: 3469690.66,
        total: 25155254.30,
      },
      confirmadas: { pedidos: 2779, total: 25923646.37 },
      devueltas: { pedidos: 89, total: 768392.07 },
      canceladas: { pedidos: 221, total: 1717143.97 },
    });
    expect(report.totales.netas.productos
      + report.totales.netas.envio
      + report.totales.netas.iva).toBe(report.totales.netas.total);
    expect(Object.fromEntries(
      Object.entries(report.porSucursal).map(([id, value]) => [id, value.productos]),
    )).toEqual(BRANCH_PRODUCTS);
    expect(Object.fromEntries(
      Object.entries(report.porSucursal).map(([id, value]) => [id, value.pedidos]),
    )).toEqual({ gdl: 996, zap: 484, leo: 450, qro: 442, ags: 318 });
    expect(Object.fromEntries(
      Object.entries(report.porSucursalQueSurte).map(([id, value]) => [id, value.productos]),
    )).toEqual({
      gdl: 8268065.26,
      zap: 3497357.14,
      leo: 3442065.60,
      qro: 3471703.90,
      ags: 2871521.74,
    });
    expect(report.fueraDeSucursal).toEqual({ pedidos: 195, productos: 1459729.32 });
    expect(Object.keys(report.porSucursalQueSurte.gdl)).toEqual(["pedidos", "productos"]);
    expect(Object.keys(report.matriz.gdl.gdl)).toEqual(["pedidos", "productos"]);
    expect(Object.keys(report.porMes["2026-09"])).toEqual(["pedidos", "productos", "total"]);
    expect(reconcileReport(report).sumaSucursalesIgualTotal).toBe(true);
  });

  it("suma las líneas por producto y agrega dimensiones de cliente solo con índice", () => {
    const withoutCustomers = buildSalesReport(pedidos);
    expect(withoutCustomers.porTipoCliente).toBeNull();
    expect(withoutCustomers.porTamano).toBeNull();

    const index = new Map(clientes.map((cliente) => [
      cliente.idCliente,
      { tipoCliente: cliente.tipoCliente, tamano: cliente.tamano },
    ]));
    const report = buildSalesReport(pedidos, { clientesIndex: index });
    expect(report.porTipoCliente).not.toBeNull();
    expect(report.porTamano).not.toBeNull();
    expect(report.porProducto["CUB-20"].unidades).toBeGreaterThan(0);
    expect(report.porProducto["CUB-20"].total).toBeGreaterThan(
      report.porProducto["CUB-20"].importe,
    );
  });

  it("concilia por mes, por sucursal y detecta un reporte alterado", () => {
    const allMonths = buildSalesReport(pedidos);
    for (const periodo of Object.keys(allMonths.porMes)) {
      expect(reconcileReport(buildSalesReport(pedidos, { periodo }))
        .sumaSucursalesIgualTotal).toBe(true);
    }
    for (const idSucursal of Object.keys(BRANCH_PRODUCTS)) {
      expect(reconcileReport(buildSalesReport(pedidos, { idSucursal }))
        .sumaSucursalesIgualTotal).toBe(true);
    }
    const altered = structuredClone(allMonths);
    altered.porSucursal.gdl.productos += 1;
    expect(reconcileReport(altered).sumaSucursalesIgualTotal).toBe(false);
  });

  it("reporta septiembre de 2026 con la sucursal de venta", () => {
    const report = buildSalesReport(pedidos, { periodo: "2026-09" });
    expect(Object.fromEntries(
      Object.entries(report.porSucursal).map(([id, value]) => [id, value.productos]),
    )).toEqual({
      gdl: 1641691.28,
      zap: 832964.70,
      leo: 653579.36,
      qro: 658208.12,
      ags: 318236.80,
    });
    expect(report.totales.netas.productos).toBe(4104680.26);
    expect(reconcileReport(report).sumaSucursalesIgualTotal).toBe(true);
  });
});
