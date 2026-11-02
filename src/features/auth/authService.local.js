// Inicio de sesión local de demostración; este módulo solo se carga en modo local.
import { getRole } from "./permissions.js";
import { localStore } from "../../shared/storage/localStore.js";
import { STORAGE_KEYS } from "../../config/constants.js";
import { accountOverridesRepository, createAccountOverridesRepository } from "../admin/accountOverridesRepository.js";
import { usuarios } from "./localAccounts.js";

const HORAS_SESION = 8;

function overridesFor(store, overrides) {
  return overrides
    || (store === localStore
      ? accountOverridesRepository
      : createAccountOverridesRepository({ store }));
}

function armarSesion(u) {
  const rol = getRole(u.rol);
  return {
    usuario: u.usuario, nombre: u.nombre, rol: u.rol, esEmpleado: Boolean(rol && rol.esEmpleado),
    puesto: u.puesto || null, idEmpleado: u.idEmpleado || null, idCliente: u.idCliente || null, idSucursal: u.idSucursal,
    alcance: rol ? rol.alcance : null, expiraEn: Date.now() + HORAS_SESION * 3600 * 1000,
  };
}

export function login(usuario, password, store = localStore, overrides) {
  const nombre = String(usuario || "").trim().toLowerCase();
  if (!nombre || !password) return { ok: false, error: "Escribe tu usuario y tu contraseña." };
  const user = usuarios.find((item) => item.usuario.toLowerCase() === nombre && item.password === password);
  if (!user) return { ok: false, error: "Usuario o contraseña incorrectos." };
  if (overridesFor(store, overrides).isDisabled(nombre)) {
    return { ok: false, error: "Tu cuenta está desactivada. Contacta a Soporte y sistemas." };
  }
  const session = armarSesion(user);
  store.set(STORAGE_KEYS.session, session);
  return { ok: true, session };
}

/** Cuentas demo con contraseña solo para el acceso rápido local. */
export const CUENTAS_DEMO = ["ernesto", "laura", "mariana", "tono", "carlos", "cliente1"]
  .map((username) => usuarios.find((user) => user.usuario === username))
  .filter(Boolean)
  .map((user) => ({
    usuario: user.usuario,
    password: user.password,
    nombre: user.nombre,
    detalle: user.puesto || `Cliente · ${user.tamano}`,
  }));