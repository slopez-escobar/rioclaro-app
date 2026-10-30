import { describe, expect, it } from "vitest";
import { can } from "../src/features/auth/permissions.js";
import { roles } from "../src/features/auth/data/roles.json";
import { listPedidos } from "../src/data/repositories/pedidosRepository.js";

describe("permisos de pedidos", () => {
  it("coincide con la matriz real de lectura para los 11 roles", async () => {
    expect(roles).toHaveLength(11);
    for (const role of roles) {
      const session = {
        rol: role.codigo,
        alcance: role.alcance,
        idSucursal: "gdl",
        idCliente: "CLI-0218",
      };
      const allowed = role.permisos.pedidos.includes("ver");
      expect(can(role.codigo, "pedidos", "ver")).toBe(allowed);
      if (allowed) {
        expect(await listPedidos(session)).toBeInstanceOf(Array);
      } else {
        await expect(listPedidos(session)).rejects.toThrow("No tienes permiso para ver pedidos");
      }
    }
  }, 20_000);
});
