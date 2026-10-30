import { describe, expect, it } from "vitest";
import { filterOrders } from "../src/features/orders/domain/orderFilters.js";
import { getOrderStateLabel } from "../src/features/orders/domain/orderLabels.js";
import { calculateOrderTotals } from "../src/features/orders/domain/orderTotals.js";

describe("dominio de pedidos", () => {
  it("suma importes en centavos y cuenta estados", () => {
    const summary = calculateOrderTotals([
      {
        estado: "entregado",
        resumen: { subtotalProductos: 0.1, costoEnvio: 0.2, subtotal: 0.3, iva: { importe: 0.05 }, total: 0.35 },
      },
      {
        estado: "cancelado",
        resumen: { subtotalProductos: 1.2, costoEnvio: 0, subtotal: 1.2, iva: { importe: 0.19 }, total: 1.39 },
      },
      { estado: "en_ruta", resumen: {} },
    ]);

    expect(summary).toMatchObject({
      cantidad: 3,
      enCurso: 1,
      entregados: 1,
      cancelados: 1,
      devueltos: 0,
      subtotalProductos: 1.3,
      costoEnvio: 0.2,
      subtotal: 1.5,
      iva: 0.24,
      total: 1.74,
      porEstado: { entregado: 1, cancelado: 1, en_ruta: 1 },
    });
  });

  it("filtra por fechas, estado, entrega, sucursal y texto sin distinguir acentos", () => {
    const orders = [
      {
        folio: "RC-001",
        fechaPedido: "2025-01-03T10:00",
        estado: "entregado",
        tipoEntrega: "envio_a_domicilio",
        idSucursal: "gdl",
        clienteNombre: "José García",
        articulos: [{ descripcion: "Pintura blanca" }],
      },
      {
        folio: "RC-002",
        fechaPedido: "2025-01-05T10:00",
        estado: "cancelado",
        tipoEntrega: "recoger_en_sucursal",
        idSucursal: "leon",
        clienteNombre: "Ana",
        articulos: [],
      },
    ];

    expect(filterOrders(orders, {
      desde: "2025-01-02",
      hasta: "2025-01-04",
      estado: "entregado",
      tipoEntrega: "envio_a_domicilio",
      idSucursal: "gdl",
      texto: "jose garcia",
    })).toEqual([orders[0]]);
    expect(filterOrders(orders, { texto: "pintura blanca" })).toEqual([orders[0]]);
  });

  it("prefiere la descripción del catálogo de estatus", () => {
    expect(getOrderStateLabel("pendiente_confirmacion", [
      { codigo: "pendiente_confirmacion", descripcion: "El pedido se recibió y falta confirmarlo" },
    ])).toBe("El pedido se recibió y falta confirmarlo");
  });
});
