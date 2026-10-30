// Permisos por rol, a partir de roles.json (catálogo de puestos y roles).
import { roles } from "./data/roles.json";

const ROLES = Object.fromEntries(roles.map((r) => [r.codigo, r]));

export const getRole = (codigo) => ROLES[codigo] || null;

/** ¿El rol puede hacer `accion` en `modulo`? Ej.: can("finanzas", "facturas_proveedores", "aprobar"). */
export function can(codigo, modulo, accion) {
  const r = ROLES[codigo];
  return Boolean(r && r.permisos[modulo] && r.permisos[modulo].includes(accion));
}

/** Alcance de los datos: "todas" (sucursales), "sucursal" o "propio" (cliente). */
export const alcanceDe = (codigo) => (ROLES[codigo] ? ROLES[codigo].alcance : null);

/** Primera pantalla después de entrar: facturas si el rol puede verlas; si no, el asistente. */
export function landingPath(codigo) {
  if (codigo === "direccion" && can(codigo, "reporte_ventas", "ver")) return "/panel";
  return can(codigo, "facturas_proveedores", "ver") ? "/facturas" : "/asistente";
}
