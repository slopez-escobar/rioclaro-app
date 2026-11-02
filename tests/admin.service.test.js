import { describe, expect, it } from "vitest";
import { roles } from "../src/features/auth/data/roles.json";
import { usuarios } from "../src/features/auth/data/usuarios.json";
import { can } from "../src/features/auth/permissions.js";
import { createAssistantSwitch } from "../src/features/chat/assistantSwitchRepository.js";
import { createChatService } from "../src/features/chat/chatService.js";
import { createLocalStore } from "../src/shared/storage/localStore.js";
import { createAccountOverridesRepository } from "../src/features/admin/accountOverridesRepository.js";
import { createAdminAuditRepository } from "../src/features/admin/adminAuditRepository.js";
import { createAdminService } from "../src/features/admin/adminService.js";
import { getSession } from "../src/features/auth/authService.js";
import { login } from "../src/features/auth/authService.local.js";
import { sessionFor } from "./chatTestUtils.js";

function memoryStore() {
  const values = new Map();
  return createLocalStore({
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  });
}

function setupAdmin() {
  const store = memoryStore();
  const overrides = createAccountOverridesRepository({ store });
  const audit = createAdminAuditRepository({ store });
  const switchRepo = createAssistantSwitch({ store, envEnabled: true });
  const service = createAdminService({
    usuarios,
    roles,
    overrides,
    audit,
    switchRepo,
    now: () => "2026-10-29T12:00:00.000Z",
  });
  return { service, overrides, audit, switchRepo, store };
}

describe("servicio de administración", () => {
  it("resume 150 cuentas sin exponer contraseñas ni datos sensibles", () => {
    const { service } = setupAdmin();
    const summary = service.getSummary(sessionFor("carlos"));
    expect(summary).toMatchObject({
      cuentas: 150,
      empleados: 140,
      clientes: 10,
      desactivadas: 0,
      roles: 11,
      quienVeNominas: ["direccion", "rh"],
      sinContrasenasEnPantalla: true,
    });
    const accounts = service.listAccounts(sessionFor("carlos"), {}, { page: 1, pageSize: 100 });
    const serialized = JSON.stringify(accounts.cuentas).toLowerCase();
    expect(accounts.total).toBe(150);
    for (const forbidden of ["password", "salario", "rfc", "correo", "telefono"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("combina filtros sin ampliar resultados y encuentra a Carmen por texto", () => {
    const { service } = setupAdmin();
    const admin = sessionFor("carlos");
    const branchSales = service.listAccounts(admin, {
      rol: "ventas",
      idSucursal: "leo",
    }, { page: 1, pageSize: 100 });
    expect(branchSales.total).toBeGreaterThan(0);
    expect(branchSales.cuentas.every((account) =>
      account.rol === "ventas" && account.idSucursal === "leo",
    )).toBe(true);
    const carmen = service.listAccounts(admin, { texto: "carmen" }, { page: 1, pageSize: 100 });
    expect(carmen.cuentas).toContainEqual(expect.objectContaining({
      usuario: "carmen.ramos",
      nombre: "Carmen Ramos",
    }));
    expect(carmen.cuentas[0]).not.toHaveProperty("password");
  });

  it("desactiva, invalida sesiones, registra auditoría y permite reactivar", () => {
    const { service, overrides, audit } = setupAdmin();
    const admin = sessionFor("carlos");
    const targetStore = memoryStore();
    expect(login("carmen.ramos", "demo123", targetStore, overrides).ok).toBe(true);
    service.disableAccount(admin, "carmen.ramos", "Cuenta duplicada");
    expect(overrides.isDisabled("carmen.ramos")).toBe(true);
    expect(getSession(targetStore, overrides)).toBeNull();
    expect(login("carmen.ramos", "incorrecta", targetStore, overrides)).toMatchObject({
      ok: false,
      error: "Usuario o contraseña incorrectos.",
    });
    expect(login("carmen.ramos", "demo123", targetStore, overrides)).toEqual({
      ok: false,
      error: "Tu cuenta está desactivada. Contacta a Soporte y sistemas.",
    });
    expect(audit.list(20)[0]).toMatchObject({
      usuario: "carlos",
      accion: "cuenta_desactivada",
      objetivo: "Carmen Ramos (carmen.ramos)",
      comentario: "Cuenta duplicada",
    });
    service.enableAccount(admin, "carmen.ramos");
    expect(overrides.isDisabled("carmen.ramos")).toBe(false);
    expect(login("carmen.ramos", "demo123", targetStore, overrides).ok).toBe(true);
    expect(audit.list(20)[0].accion).toBe("cuenta_reactivada");
  });

  it("bloquea la cuenta propia, comentarios cortos y reactivaciones inválidas", () => {
    const { service } = setupAdmin();
    const admin = sessionFor("carlos");
    expect(() => service.disableAccount(admin, "carlos", "motivo"))
      .toThrow("No puedes desactivar tu propia cuenta");
    expect(() => service.disableAccount(admin, "carmen.ramos", "no"))
      .toThrow("El motivo es obligatorio (mínimo 5 caracteres)");
    expect(() => service.enableAccount(admin, "carmen.ramos"))
      .toThrow("La cuenta no está desactivada");
  });

  it.each(["laura", "ernesto", "mariana", "tono", "yesenia.flores", "cliente1"])(
    "deniega acceso a %s",
    (username) => {
      const { service } = setupAdmin();
      expect(() => service.listAccounts(sessionFor(username)))
        .toThrow("No tienes permiso para administrar accesos");
    },
  );

  it("construye la matriz de permisos desde los roles vigentes", () => {
    const { service } = setupAdmin();
    const matrix = service.getRoleMatrix(sessionFor("carlos"));
    expect(matrix.roles).toHaveLength(11);
    expect(matrix.roles.filter((role) =>
      matrix.modulos.find((module) => module.codigo === "usuarios_y_accesos")
        .permisos[role.codigo].includes("ver"),
    ).map((role) => role.codigo)).toEqual(["administrador_ti"]);
    for (const role of roles) {
      const access = matrix.modulos.find((module) => module.codigo === "usuarios_y_accesos")
        .permisos[role.codigo].includes("ver");
      expect(access).toBe(can(role.codigo, "usuarios_y_accesos", "ver"));
    }
  });

  it("audita cambios del asistente desde administración y desde el chat", () => {
    const { service, switchRepo, audit } = setupAdmin();
    const admin = sessionFor("carlos");
    expect(service.setAssistantEnabled(admin, false)).toBe(false);
    expect(service.setAssistantEnabled(admin, true)).toBe(true);
    expect(audit.list(20).map((entry) => entry.accion)).toEqual([
      "asistente_encendido",
      "asistente_apagado",
    ]);
    expect(() => service.setAssistantEnabled(sessionFor("laura"), false))
      .toThrow("No tienes permiso para administrar accesos");

    const chat = createChatService({ admin: service, switchRepo });
    expect(chat.setEnabled(false, admin)).toBe(false);
    expect(audit.list(20)[0]).toMatchObject({
      usuario: "carlos",
      accion: "asistente_apagado",
    });
  });

  it("restablece solo las cuentas y la auditoría sin cambiar el asistente", () => {
    const { service, overrides, audit, switchRepo, store } = setupAdmin();
    const admin = sessionFor("carlos");
    store.set("chat:carlos", [{ texto: "conversación preservada" }]);
    store.set("complaints", [{ folio: "QJ-2026-0001" }]);
    store.set("invoices", [{ idFactura: "F-001" }]);
    service.disableAccount(admin, "carmen.ramos", "Cuenta duplicada");
    service.setAssistantEnabled(admin, false);
    service.reset(admin);
    expect(overrides.list()).toEqual([]);
    expect(audit.list()).toEqual([]);
    expect(switchRepo.isEnabled()).toBe(false);
    expect(store.get("chat:carlos")).toEqual([{ texto: "conversación preservada" }]);
    expect(store.get("complaints")).toEqual([{ folio: "QJ-2026-0001" }]);
    expect(store.get("invoices")).toEqual([{ idFactura: "F-001" }]);
  });
});
