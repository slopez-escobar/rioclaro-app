import { describe, expect, it } from "vitest";
import { can } from "../src/features/auth/permissions.js";
import { roles } from "../src/features/auth/data/roles.json";

const ROLES_WITH_ACCESS = new Set([
  "direccion",
  "compras",
  "gerente_sucursal",
  "ventas",
  "bodega",
]);

describe("permisos de existencias", () => {
  it("coincide con la matriz de can() para los 11 roles", () => {
    expect(roles).toHaveLength(11);
    for (const role of roles) {
      const expected = ROLES_WITH_ACCESS.has(role.codigo);
      expect(can(role.codigo, "existencias", "ver")).toBe(expected);
      expect(role.permisos.existencias.includes("ver")).toBe(expected);
    }
  });
});
