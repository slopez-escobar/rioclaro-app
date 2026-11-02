import { readFileSync } from "node:fs";

const { roles } = JSON.parse(
  readFileSync(new URL("../../data/roles.json", import.meta.url), "utf8"),
);
const rolesByCode = new Map(roles.map((role) => [role.codigo, role]));

export function can(rol, modulo, accion) {
  return Boolean(rolesByCode.get(rol)?.permisos?.[modulo]?.includes(accion));
}

export function getRole(rol) {
  return rolesByCode.get(rol) ?? null;
}
