import { describe, expect, it } from "vitest";
import { can } from "../src/features/auth/permissions.js";
import { roles } from "../src/features/auth/data/roles.json";

describe("permisos del reporte de ventas", () => {
  it("autoriza solo dirección, finanzas y gerencia de sucursal", () => {
    const allowed = roles
      .filter((role) => can(role.codigo, "reporte_ventas", "ver"))
      .map((role) => role.codigo)
      .sort();
    expect(allowed).toEqual(["direccion", "finanzas", "gerente_sucursal"]);
    expect(roles).toHaveLength(11);
  });
});
