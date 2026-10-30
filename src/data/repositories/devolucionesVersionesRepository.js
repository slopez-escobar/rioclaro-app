import { getRole } from "../../features/auth/permissions.js";
import { copy } from "./repositoryUtils.js";

function requireEmployee(session) {
  if (getRole(session?.rol)?.esEmpleado !== true) {
    throw new Error("Esta información es solo para empleados");
  }
}

/**
 * Crea un cargador diferido que solo conserva en caché la carga exitosa.
 * @param {Function} importer Importador dinámico del JSON.
 */
export function createVersionesLoader(importer) {
  let value;
  let loaded = false;
  return async () => {
    if (loaded) return value;
    try {
      const module = await importer();
      value = module.default;
      loaded = true;
      return value;
    } catch (cause) {
      throw new Error(
        "No se pudo cargar el comparador de versiones de devoluciones.",
        { cause },
      );
    }
  };
}

const loadVersiones = createVersionesLoader(
  () => import("@data/source/devoluciones-versiones.json"),
);

/** Devuelve el comparador de devoluciones exclusivamente a empleados. */
export async function getVersiones(session) {
  requireEmployee(session);
  return copy(await loadVersiones());
}
