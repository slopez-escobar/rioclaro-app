import path from "node:path";
import { fileURLToPath } from "node:url";
import { DATA_DIR, FUENTES, ROOT } from "../../scripts/datos.config.mjs";

const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

if (ROOT !== PROJECT_ROOT) {
  throw new Error("La raíz del proyecto no coincide con la ruta de scripts/datos.config.mjs.");
}

export { DATA_DIR, FUENTES, ROOT };
