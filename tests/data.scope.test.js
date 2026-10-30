import { describe, expect, it } from "vitest";
import {
  canSeeCliente,
  canSeeExistencia,
  canSeePedido,
  canSeeQueja,
  getScope,
} from "../src/data/scope.js";

describe("alcance de datos", () => {
  it("rechaza sesiones sin un alcance reconocido", () => {
    for (const session of [null, {}, { alcance: "otra" }]) {
      expect(() => getScope(session)).toThrowError("Sesión sin alcance válido");
    }
  });

  it("devuelve alcance e identificadores de la sesión", () => {
    expect(getScope({ alcance: "sucursal", idSucursal: "leo", idCliente: null }))
      .toEqual({ alcance: "sucursal", idSucursal: "leo", idCliente: null });
  });

  it("aplica el alcance de clientes, pedidos, existencias y quejas", () => {
    const sucursal = { alcance: "sucursal", idSucursal: "leo" };
    const propio = { alcance: "propio", idCliente: "CLI-1" };
    const cliente = { idCliente: "CLI-1", idSucursal: "qro" };
    const pedido = { idCliente: "CLI-2", idSucursal: "qro", idSucursalSurtido: "leo" };
    const existencia = { idSucursal: "leo" };
    const queja = { idCliente: "CLI-1", idSucursal: "qro", idSucursalSurtido: "leo" };

    expect(canSeeCliente({ alcance: "todas" }, cliente)).toBe(true);
    expect(canSeeCliente(sucursal, cliente)).toBe(false);
    expect(canSeeCliente(propio, cliente)).toBe(true);
    expect(canSeePedido(sucursal, pedido)).toBe(true);
    expect(canSeePedido(propio, pedido)).toBe(false);
    expect(canSeeExistencia(sucursal, existencia)).toBe(true);
    expect(canSeeExistencia(propio, existencia)).toBe(false);
    expect(canSeeQueja(sucursal, queja)).toBe(true);
    expect(canSeeQueja(propio, queja)).toBe(true);
    expect(canSeeQueja({ alcance: "propio", idCliente: "CLI-2" }, queja)).toBe(false);
  });
});
