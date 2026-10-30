import { can } from "../../features/auth/permissions.js";
import { copy } from "./repositoryUtils.js";

function requirePermission(session) {
  if (!can(session?.rol, "reporte_ventas", "ver")) {
    throw new Error("No tienes permiso para ver el reporte de ventas");
  }
}

export function createConciliationLoader(importer) {
  let conciliacion;
  let loaded = false;
  return async () => {
    if (loaded) return conciliacion;
    try {
      const module = await importer();
      conciliacion = module.default;
      loaded = true;
      return conciliacion;
    } catch (cause) {
      throw new Error(
        "No se pudo cargar la conciliación de ventas. Ejecuta npm run ventas:conciliar y recarga la página.",
        { cause },
      );
    }
  };
}

const loadConciliacion = createConciliationLoader(
  () => import("@data/source/ventas-conciliacion.json"),
);

/** Devuelve la conciliación permitida por el rol y alcance de la sesión. */
export async function getConciliacion(session) {
  requirePermission(session);
  const report = await loadConciliacion();
  if (session?.alcance === "sucursal") {
    return copy({
      ...report,
      sucursales: report.sucursales.filter((branch) => branch.id === session.idSucursal),
      resumen: null,
    });
  }
  return copy(report);
}
