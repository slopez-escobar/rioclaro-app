import { describe, expect, it } from "vitest";
import { ROUTE_ACCESS } from "../src/app/routeAccess.js";
import { landingPath, can } from "../src/features/auth/permissions.js";
import { roles } from "../src/features/auth/data/roles.json";

const expectedLanding = {
  direccion: "/panel",
  finanzas: "/facturas",
  compras: "/facturas",
  rh: "/asistente",
  administrador_ti: "/asistente",
  gerente_sucursal: "/asistente",
  ventas: "/asistente",
  bodega: "/asistente",
  reparto: "/asistente",
  administrativo: "/asistente",
  cliente: "/asistente",
};

function accessFor(role, route) {
  if (route.redirect) return "redirigida";
  if (!route.module) return "permitida";
  return can(role, route.module, route.action || "ver") ? "permitida" : "redirigida";
}

describe("matriz de acceso de rutas", () => {
  it("incluye cada ruta registrada para los 11 roles", () => {
    expect(roles).toHaveLength(11);
    expect(ROUTE_ACCESS.map(({ path }) => path)).toEqual([
      "/login", "/ia-responsable", "/panel", "/admin", "/politicas", "/asistente",
      "/facturas", "/pedidos", "/ventas", "/quejas", "/existencias", "/catalogo", "/", "*",
    ]);
    for (const role of roles) {
      expect(ROUTE_ACCESS.map((route) => accessFor(role.codigo, route))).toHaveLength(ROUTE_ACCESS.length);
    }
  });

  it("coincide con can() para cada pareja rol-ruta", () => {
    for (const role of roles) {
      for (const route of ROUTE_ACCESS) {
        const expected = route.redirect
          ? "redirigida"
          : !route.module || can(role.codigo, route.module, route.action || "ver")
            ? "permitida"
            : "redirigida";
        expect(accessFor(role.codigo, route)).toBe(expected);
      }
    }
  });

  it("conserva la pantalla inicial de cada uno de los 11 roles", () => {
    for (const role of roles) {
      expect(landingPath(role.codigo)).toBe(expectedLanding[role.codigo]);
    }
  });
});
