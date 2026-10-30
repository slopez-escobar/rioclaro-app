import { describe, expect, it } from "vitest";
import {
  canDisableAccount,
  canManageAccounts,
  validateDisableComment,
} from "../src/features/admin/domain/accountRules.js";
import { sessionFor } from "./chatTestUtils.js";

describe("reglas de administración de cuentas", () => {
  it("permite administrar solo al rol autorizado", () => {
    expect(canManageAccounts(sessionFor("carlos"))).toBe(true);
    expect(canManageAccounts(sessionFor("laura"))).toBe(false);
    expect(canDisableAccount(sessionFor("laura"), { usuario: "carmen.ramos" })).toEqual({
      permitido: false,
      motivo: "No tienes permiso para administrar cuentas",
    });
  });

  it("impide desactivar la cuenta propia o una cuenta ya desactivada", () => {
    const admin = sessionFor("carlos");
    expect(canDisableAccount(admin, { usuario: "carlos" }).motivo)
      .toBe("No puedes desactivar tu propia cuenta");
    expect(canDisableAccount(admin, { usuario: "carmen.ramos" }, {
      desactivadas: { "carmen.ramos": true },
    }).motivo).toBe("La cuenta ya está desactivada");
  });

  it("requiere motivo de al menos cinco caracteres", () => {
    expect(validateDisableComment("no").motivo)
      .toBe("El motivo es obligatorio (mínimo 5 caracteres)");
    expect(validateDisableComment("error de acceso").valido).toBe(true);
  });
});
