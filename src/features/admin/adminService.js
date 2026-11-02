import { usuarios } from "./data/accounts.json";
import { roles } from "../auth/data/roles.json";
import { can } from "../auth/permissions.js";
import { listSucursales } from "../../data/repositories/sucursalesRepository.js";
import { normalizeText } from "../../data/repositories/repositoryUtils.js";
import { accountOverridesRepository } from "./accountOverridesRepository.js";
import { adminAuditRepository } from "./adminAuditRepository.js";
import { assistantSwitch } from "../chat/assistantSwitchRepository.js";
import {
  canDisableAccount,
  canManageAccounts,
  validateDisableComment,
} from "./domain/accountRules.js";

const MODULE_LABELS = {
  facturas_proveedores: "Facturas de proveedores",
  proveedores: "Proveedores",
  pedidos: "Pedidos",
  clientes: "Clientes",
  quejas: "Quejas",
  existencias: "Existencias",
  reporte_ventas: "Reporte de ventas",
  empleados: "Empleados",
  nominas: "Nóminas",
  usuarios_y_accesos: "Usuarios y accesos",
  asistente_ia: "Asistente de IA",
};

function requireAccess(session) {
  if (!can(session?.rol, "usuarios_y_accesos", "ver")) {
    throw new Error("No tienes permiso para administrar accesos");
  }
}

function createAccount(user, roleById, branchById, disabledByUser) {
  const role = roleById.get(user.rol);
  if (!role) throw new Error(`El usuario ${user.usuario} tiene un rol no reconocido.`);
  const branch = branchById.get(user.idSucursal);
  const account = {
    usuario: user.usuario,
    nombre: user.nombre,
    puesto: user.puesto || "",
    rol: user.rol,
    nombreRol: role.nombre,
    alcance: role.alcance,
    idSucursal: user.idSucursal || null,
    nombreSucursal: branch?.nombre || "Sin sucursal",
    tipo: user.idEmpleado ? "empleado" : "cliente",
  };
  if (user.idEmpleado) account.idEmpleado = user.idEmpleado;
  if (user.idCliente) account.idCliente = user.idCliente;
  const disabled = disabledByUser.get(user.usuario);
  account.estado = disabled ? "desactivada" : "activa";
  if (disabled) {
    account.desde = disabled.desde;
    account.por = disabled.por;
    account.motivo = disabled.motivo;
  }
  return account;
}

function auditEntry(session, accion, objetivo, comentario, now) {
  return {
    fecha: now(),
    usuario: session.usuario,
    nombre: session.nombre,
    accion,
    objetivo,
    comentario,
  };
}

/**
 * Crea el servicio para administrar cuentas, permisos, el asistente y auditoría.
 * @param {Object} dependencies Fuentes de datos y repositorios.
 */
export function createAdminService({
  usuarios: accounts = usuarios,
  roles: roleDefinitions = roles,
  sucursales = listSucursales,
  overrides = accountOverridesRepository,
  audit = adminAuditRepository,
  switchRepo = assistantSwitch,
  now = () => new Date().toISOString(),
} = {}) {
  function getAccounts() {
    const branchValues = typeof sucursales === "function" ? sucursales() : sucursales;
    const branchById = new Map(branchValues.map((branch) => [branch.id, branch]));
    const roleById = new Map(roleDefinitions.map((role) => [role.codigo, role]));
    const disabledByUser = new Map(overrides.list().map((entry) => [entry.usuario, entry]));
    return accounts.map((user) => createAccount(user, roleById, branchById, disabledByUser));
  }

  function listAccounts(session, filtros = {}, { page = 1, pageSize = 20 } = {}) {
    requireAccess(session);
    const text = normalizeText(String(filtros.texto ?? "").trim());
    const filtered = getAccounts().filter((account) => {
      if (text && !normalizeText([account.usuario, account.nombre, account.puesto].join(" ")).includes(text)) return false;
      if (filtros.rol && filtros.rol !== "todos" && account.rol !== filtros.rol) return false;
      if (filtros.idSucursal && filtros.idSucursal !== "todas" && account.idSucursal !== filtros.idSucursal) return false;
      if (filtros.estado && filtros.estado !== "todos" && account.estado !== filtros.estado) return false;
      if (filtros.tipo && filtros.tipo !== "todos" && account.tipo !== filtros.tipo) return false;
      return true;
    });
    const safePageSize = Math.min(100, Math.max(1, Math.floor(Number(pageSize) || 20)));
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / safePageSize));
    const safePage = Math.min(totalPages, Math.max(1, Math.floor(Number(page) || 1)));
    const start = (safePage - 1) * safePageSize;
    return {
      cuentas: filtered.slice(start, start + safePageSize),
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages,
    };
  }

  function getSummary(session) {
    requireAccess(session);
    const accounts = getAccounts();
    const counts = new Map();
    for (const account of accounts) {
      counts.set(account.rol, (counts.get(account.rol) || 0) + 1);
    }
    return {
      cuentas: accounts.length,
      empleados: accounts.filter((account) => account.tipo === "empleado").length,
      clientes: accounts.filter((account) => account.tipo === "cliente").length,
      desactivadas: accounts.filter((account) => account.estado === "desactivada").length,
      porRol: roleDefinitions.map((role) => ({
        codigo: role.codigo,
        nombre: role.nombre,
        cantidad: counts.get(role.codigo) || 0,
      })),
      roles: roleDefinitions.length,
      quienVeNominas: roleDefinitions
        .filter((role) => role.permisos.nominas?.includes("ver"))
        .map((role) => role.codigo),
      sinContrasenasEnPantalla: true,
    };
  }

  function getRoleMatrix(session) {
    requireAccess(session);
    const moduleCodes = [...new Set(roleDefinitions.flatMap((role) => Object.keys(role.permisos)))];
    return {
      roles: roleDefinitions.map(({ codigo, nombre, alcance }) => ({ codigo, nombre, alcance })),
      modulos: moduleCodes.map((codigo) => ({
        codigo,
        nombre: MODULE_LABELS[codigo] || codigo,
        permisos: Object.fromEntries(roleDefinitions.map((role) => [
          role.codigo,
          [...(role.permisos[codigo] || [])],
        ])),
      })),
    };
  }

  function getFilterOptions(session) {
    requireAccess(session);
    const branchValues = typeof sucursales === "function" ? sucursales() : sucursales;
    return {
      roles: roleDefinitions.map(({ codigo, nombre }) => ({ codigo, nombre })),
      sucursales: branchValues.map(({ id, nombre }) => ({ id, nombre })),
    };
  }

  function findAccount(usuario) {
    const user = accounts.find((item) => item.usuario === usuario);
    if (!user) throw new Error("No se encontró la cuenta solicitada.");
    return user;
  }

  function accountLabel(account) {
    return `${account.nombre} (${account.usuario})`;
  }

  function disableAccount(session, usuario, motivo) {
    requireAccess(session);
    const target = findAccount(usuario);
    const decision = canDisableAccount(session, target, {
      desactivadas: new Map(overrides.list().map((item) => [item.usuario, item])),
    });
    if (!decision.permitido) throw new Error(decision.motivo);
    const comment = validateDisableComment(motivo);
    if (!comment.valido) throw new Error(comment.motivo);
    const entry = overrides.disable(usuario, {
      desde: now(),
      por: session.usuario,
      motivo: String(motivo).trim(),
    });
    try {
      audit.append(auditEntry(session, "cuenta_desactivada", accountLabel(target), entry.motivo, now));
    } catch (error) {
      overrides.enable(usuario);
      throw error;
    }
    return { usuario, estado: "desactivada", ...entry };
  }

  function getDisableAccountRule(session, usuario) {
    requireAccess(session);
    const target = findAccount(usuario);
    return canDisableAccount(session, target, {
      desactivadas: new Map(overrides.list().map((item) => [item.usuario, item])),
    });
  }

  function enableAccount(session, usuario) {
    requireAccess(session);
    const target = findAccount(usuario);
    if (!canManageAccounts(session)) {
      throw new Error("No tienes permiso para administrar cuentas");
    }
    const previous = overrides.list().find((entry) => entry.usuario === usuario);
    if (!previous) throw new Error("La cuenta no está desactivada");
    overrides.enable(usuario);
    try {
      audit.append(auditEntry(session, "cuenta_reactivada", accountLabel(target), previous.motivo, now));
    } catch (error) {
      overrides.disable(usuario, previous);
      throw error;
    }
    return { usuario, estado: "activa" };
  }

  function setAssistantEnabled(session, valor) {
    requireAccess(session);
    if (!can(session?.rol, "usuarios_y_accesos", "apagar_asistente")) {
      throw new Error("No tienes permiso para apagar el asistente");
    }
    const previous = switchRepo.isEnabled();
    const enabled = switchRepo.setEnabled(valor, session);
    if (enabled === previous) return enabled;
    try {
      audit.append(auditEntry(
        session,
        enabled ? "asistente_encendido" : "asistente_apagado",
        "Asistente de IA",
        enabled ? "Asistente encendido" : "Asistente apagado",
        now,
      ));
    } catch (error) {
      switchRepo.setEnabled(previous, session);
      throw error;
    }
    return enabled;
  }

  return {
    listAccounts,
    getSummary,
    getRoleMatrix,
    getFilterOptions,
    getDisableAccountRule,
    disableAccount,
    enableAccount,
    setAssistantEnabled,
    getAssistantState(session) {
      requireAccess(session);
      return { enabled: switchRepo.isEnabled() };
    },
    listAudit(session) {
      requireAccess(session);
      return audit.list(20);
    },
    reset(session) {
      requireAccess(session);
      overrides.reset();
      audit.reset();
      return {
        desactivadas: 0,
        auditoria: 0,
        assistantEnabled: switchRepo.isEnabled(),
      };
    },
  };
}

export const adminService = createAdminService();
