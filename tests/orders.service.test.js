import { describe, expect, it } from "vitest";
import { sessionFor } from "./chatTestUtils.js";
import { getOrderDetail, getOrdersData } from "../src/features/orders/orderService.js";

describe("servicio de pedidos", () => {
  it("presenta los 3,000 pedidos con importes consistentes y etiquetas del catálogo", async () => {
    const result = await getOrdersData(sessionFor("ernesto"));

    expect(result.summary).toMatchObject({
      cantidad: 3000,
      enCurso: 97,
      entregados: 2593,
      cancelados: 221,
      devueltos: 89,
      subtotalProductos: 23676917.02,
      costoEnvio: 151350,
      subtotal: 23828267.02,
      iva: 3812523.32,
      total: 27640790.34,
      ventasConfirmadasMXN: 25923646.37,
    });
    expect(result.summary.ventasConfirmadasMXN).toBeCloseTo(
      result.orders
        .filter((order) => order.estado !== "cancelado")
        .reduce((sum, order) => sum + order.resumen.total, 0),
      2,
    );
    expect(result.orders).toHaveLength(3000);
    expect(result.orders.find((order) => order.estado === "pendiente_confirmacion").estadoLabel)
      .toBe("El pedido se recibió y falta confirmarlo");
    const pickup = result.orders.find((order) => order.tipoEntrega === "recoger_en_sucursal");
    expect(pickup.sucursalRecoleccionNombre).not.toBe(pickup.sucursalRecoleccion);
    expect(result.sucursales.length).toBeGreaterThan(0);
  }, 20_000);

  it("mantiene los totales del alcance y permite filtrar sin consultar otros pedidos", async () => {
    const session = sessionFor("mariana");
    const result = await getOrdersData(session, { estado: "cancelado" });

    expect(result.orders.every((order) =>
      order.estado === "cancelado"
      && (order.idSucursal === session.idSucursal || order.idSucursalSurtido === session.idSucursal),
    )).toBe(true);
    expect(result.summary.cantidad).toBeGreaterThanOrEqual(result.orders.length);
    expect(result.orders.length).toBeGreaterThan(0);
  }, 20_000);

  it("el detalle devuelve null para un pedido fuera del alcance", async () => {
    const session = sessionFor("mariana");
    const global = await getOrdersData(sessionFor("ernesto"));
    const outsideOrder = global.orders.find((order) =>
      order.idSucursal !== session.idSucursal && order.idSucursalSurtido !== session.idSucursal,
    );
    expect(outsideOrder).toBeDefined();
    expect(await getOrderDetail(session, outsideOrder.idPedido)).toBeNull();
  }, 20_000);
});
