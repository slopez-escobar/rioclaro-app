import { describe, expect, it } from "vitest";
import { roles } from "../src/features/auth/data/roles.json";
import { can } from "../src/features/auth/permissions.js";
import { canAttend } from "../src/features/complaints/domain/complaintActions.js";

const ROLE_ATTENDANCE = {
  gerente_sucursal: true,
};

describe("permisos de pantalla y atención de quejas", () => {
  it("evalúa acceso de lectura y atención para los 11 roles", () => {
    expect(roles).toHaveLength(11);
    for (const role of roles) {
      const session = {
        rol: role.codigo,
        puesto: role.codigo === "ventas" ? "Vendedor" : "Puesto de prueba",
      };
      expect(can(role.codigo, "quejas", "ver")).toBe(
        role.permisos.quejas.includes("ver"),
      );
      expect(canAttend(session)).toBe(ROLE_ATTENDANCE[role.codigo] || false);
    }
  });

  it("autoriza la excepción por puesto solo a Atención a clientes y Supervisor de ventas", () => {
    for (const puesto of ["Atención a clientes", "Supervisor de ventas"]) {
      expect(canAttend({ rol: "ventas", puesto })).toBe(true);
    }
    expect(canAttend({ rol: "ventas", puesto: "Vendedor" })).toBe(false);
    expect(can("ventas", "quejas", "ver")).toBe(true);
    expect(can("direccion", "quejas", "ver")).toBe(true);
    for (const role of [
      "finanzas",
      "compras",
      "bodega",
      "reparto",
      "administrativo",
      "administrador_ti",
      "cliente",
    ]) {
      expect(can(role, "quejas", "ver")).toBe(false);
    }
  });
});
