// Inicio y cierre de sesión. Prototipo: las credenciales viven en usuarios.json (no es seguro, solo demuestra el flujo).
import { usuarios } from "./data/usuarios.json";
import { getRole } from "./permissions.js";
import { localStore } from "../../shared/storage/localStore.js";
import { STORAGE_KEYS } from "../../config/constants.js";
import {
  accountOverridesRepository,
  createAccountOverridesRepository,
} from "../admin/accountOverridesRepository.js";

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

export function login(
  usuario,
  password,
  store = localStore,
  overrides,
) {
  const nombre = String(usuario || "").trim().toLowerCase();
  if (!nombre || !password) return { ok: false, error: "Escribe tu usuario y tu contraseña." };
  const u = usuarios.find((x) => x.usuario.toLowerCase() === nombre && x.password === password);
  if (!u) return { ok: false, error: "Usuario o contraseña incorrectos." };
  if (overridesFor(store, overrides).isDisabled(nombre)) {
    return { ok: false, error: "Tu cuenta está desactivada. Contacta a Soporte y sistemas." };
  }
  const session = armarSesion(u);
  store.set(STORAGE_KEYS.session, session);
  return { ok: true, session };
}

export function getSession(
  store = localStore,
  overrides,
) {
  const s = store.get(STORAGE_KEYS.session, null);
  if (!s) return null;
  if (s.expiraEn && s.expiraEn < Date.now()) { store.remove(STORAGE_KEYS.session); return null; }
  if (overridesFor(store, overrides).isDisabled(s.usuario)) {
    store.remove(STORAGE_KEYS.session);
    return null;
  }
  return s;
}

export function logout(store = localStore) {
  store.remove(STORAGE_KEYS.session);
}

/** Cuentas de demostración para el login rápido (personajes del caso y un cliente). */
export const CUENTAS_DEMO = ["ernesto", "laura", "mariana", "tono", "carlos", "cliente1"]
  .map((n) => usuarios.find((u) => u.usuario === n))
  .filter(Boolean)
  .map((u) => ({ usuario: u.usuario, password: u.password, nombre: u.nombre, detalle: u.puesto || `Cliente · ${u.tamano}` }));
