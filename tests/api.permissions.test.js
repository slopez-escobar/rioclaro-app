import { describe, expect, it } from "vitest";
import { can as apiCan } from "../api/src/lib/permissions.js";
import { can as appCan } from "../src/features/auth/permissions.js";
import { roles } from "../src/features/auth/data/roles.json";

describe("permisos del backend", () => {
  it("coincide con la matriz de permisos de los 11 roles", () => {
    const modules = new Set(roles.flatMap((role) => Object.keys(role.permisos)));
    const actions = new Set([
      ...roles.flatMap((role) => Object.values(role.permisos).flat()),
      "accion_inexistente",
    ]);

    for (const role of roles) {
      for (const module of modules) {
        for (const action of actions) {
          expect(apiCan(role.codigo, module, action))
            .toBe(appCan(role.codigo, module, action));
        }
      }
    }
  });
});
