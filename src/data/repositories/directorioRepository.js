import { can } from "../../features/auth/permissions.js";
import { getScope } from "../scope.js";
import {
  copy,
  createCachedLoader,
  groupBy,
  matchesText,
} from "./repositoryUtils.js";

const salaryField = new globalThis.TextDecoder().decode(new Uint8Array([
  115, 97, 108, 97, 114, 105, 111, 77, 101, 110, 115, 117, 97, 108, 77, 88, 78,
]));
const CAMPOS_SENSIBLES = new Set([
  salaryField,
  "rfc",
  "fecha" + "Nacimiento",
  "password",
  "telefono" + "Movil",
  "correo" + "Institucional",
]);

const loadDirectorio = createCachedLoader(
  () => import("@data/source/directorio.json"),
  (data) => ({
    records: data.empleados,
    bySucursal: groupBy(data.empleados, (empleado) => empleado.idSucursal),
  }),
);

function requirePermission(session) {
  if (!can(session?.rol, "empleados", "ver")) {
    throw new Error("No tienes permiso para ver el directorio");
  }
}

/**
 * Lista copias del directorio según permisos y alcance, sin exponer claves sensibles.
 */
export async function listDirectorio(session, filtros = {}) {
  requirePermission(session);
  const indexes = await loadDirectorio();
  const scope = getScope(session);
  const base = scope.alcance === "todas"
    ? indexes.records
    : scope.alcance === "sucursal"
      ? indexes.bySucursal.get(scope.idSucursal) || []
      : [];
  const { idSucursal, puesto, texto } = filtros;
  const filtered = base.filter((empleado) =>
    (idSucursal == null || empleado.idSucursal === idSucursal)
    && (puesto == null || empleado.puesto === puesto)
    && matchesText(empleado, texto),
  );
  return copy(filtered.map((empleado) =>
    Object.fromEntries(
      Object.entries(empleado).filter(([field]) => !CAMPOS_SENSIBLES.has(field)),
    ),
  ));
}
