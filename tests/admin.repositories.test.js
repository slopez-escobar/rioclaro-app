import { describe, expect, it } from "vitest";
import { createAccountOverridesRepository } from "../src/features/admin/accountOverridesRepository.js";
import { createAdminAuditRepository } from "../src/features/admin/adminAuditRepository.js";
import { createLocalStore } from "../src/shared/storage/localStore.js";

function memoryStore(initial = {}) {
  const values = new Map(Object.entries(initial));
  return createLocalStore({
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  });
}

function quotaStore() {
  return createLocalStore({
    getItem() { return null; },
    setItem() {
      const error = new Error("quota");
      error.name = "QuotaExceededError";
      throw error;
    },
    removeItem() {},
  });
}

describe("repositorios de administración", () => {
  it("trata JSON dañado como estado vacío", () => {
    const store = memoryStore({
      "rc:v1:disabledAccounts": "{ roto",
      "rc:v1:adminAudit": "{ roto",
    });
    const overrides = createAccountOverridesRepository({ store });
    const audit = createAdminAuditRepository({ store });
    expect(overrides.list()).toEqual([]);
    expect(overrides.isDisabled("carmen.ramos")).toBe(false);
    expect(audit.list()).toEqual([]);
  });

  it("guarda los datos de desactivación y falla claramente si se llena la cuota", () => {
    const overrides = createAccountOverridesRepository({ store: memoryStore() });
    overrides.disable("carmen.ramos", {
      desde: "2026-10-29T12:00:00.000Z",
      por: "carlos",
      motivo: "Cuenta duplicada",
    });
    expect(overrides.isDisabled("carmen.ramos")).toBe(true);
    expect(overrides.list()).toMatchObject([{
      usuario: "carmen.ramos",
      por: "carlos",
      motivo: "Cuenta duplicada",
    }]);
    expect(() => createAccountOverridesRepository({ store: quotaStore() }).disable("x", {
      desde: "2026-10-29",
      por: "carlos",
      motivo: "motivo válido",
    })).toThrow("almacenamiento está lleno");
  });

  it("conserva como máximo 200 acciones y lista primero las más recientes", () => {
    const audit = createAdminAuditRepository({ store: memoryStore() });
    for (let index = 0; index < 205; index += 1) {
      audit.append({
        fecha: `2026-10-29T00:${String(index).padStart(2, "0")}:00.000Z`,
        usuario: "carlos",
        nombre: "Carlos Medina",
        accion: "cuenta_desactivada",
        objetivo: `usuario-${index}`,
        comentario: "Motivo de prueba",
      });
    }
    expect(audit.list(500)).toHaveLength(200);
    expect(audit.list(1)[0].objetivo).toBe("usuario-204");
    expect(audit.list(500).at(-1).objetivo).toBe("usuario-5");
    expect(audit.list(0)).toEqual([]);
  });

  it("reporta explícitamente una cuota agotada al guardar auditoría", () => {
    const audit = createAdminAuditRepository({ store: quotaStore() });
    expect(() => audit.append({
      fecha: "2026-10-29",
      usuario: "carlos",
      nombre: "Carlos",
      accion: "asistente_apagado",
      objetivo: "Asistente",
      comentario: "",
    })).toThrow("almacenamiento está lleno");
  });
});
