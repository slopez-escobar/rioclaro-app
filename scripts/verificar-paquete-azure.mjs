import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DATA_DIR, FUENTES } from "./datos.config.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "dist-azure");
const ENV_AZURE = path.join(ROOT, ".env.azure");

if (!fs.existsSync(OUTPUT)) {
  console.error("Ejecuta primero npm run build:azure");
  process.exitCode = 1;
} else {
  function filesUnder(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const current = path.join(directory, entry.name);
      return entry.isDirectory() ? filesUnder(current) : [current];
    });
  }

  const files = filesUnder(OUTPUT);
  const contents = files.map((file) => ({
    file,
    text: fs.readFileSync(file).toString("utf8"),
  }));
  const allText = contents.map(({ text }) => text).join("\n");
  const azureEnvironment = fs.readFileSync(ENV_AZURE, "utf8");
  const apiBaseUrl = /^VITE_API_BASE_URL=(.+)$/m.exec(azureEnvironment)?.[1]?.trim();
  const credentialsPath = path.join(ROOT, "src", "features", "auth", "data", "usuarios.json");
  const localUsers = fs.existsSync(credentialsPath)
    ? JSON.parse(fs.readFileSync(credentialsPath, "utf8")).usuarios
    : [];
  const checks = [];
  const addCheck = (name, passed) => checks.push({ Comprobación: name, Resultado: passed ? "OK" : "FALLÓ" });

  addCheck("Sin contraseña demo123", !allText.includes("demo123"));
  addCheck("Sin contraseñas de cuentas locales", localUsers.length > 0
    && localUsers.every((user) => typeof user.password !== "string" || !allText.includes(user.password)));
  addCheck("Sin credenciales serializadas", !contents.some(({ text }) => /(?:["']password["']|password)\s*:\s*["'][^"']+["']/i.test(text)));
  addCheck("Sin datos salariales", !allText.includes("salarioMensualMXN"));

  const employeePath = path.join(DATA_DIR, FUENTES.empleados);
  let employeeIdentifiers = [];
  if (!fs.existsSync(DATA_DIR)) {
    console.log("omitida: data/ no disponible");
  } else {
    if (!fs.existsSync(employeePath)) {
      throw new Error(`No se encontró la fuente de empleados: ${employeePath}`);
    }
    const employeeData = JSON.parse(fs.readFileSync(employeePath, "utf8"));
    employeeIdentifiers = (employeeData.empleados || []).flatMap((employee) => [
      employee.rfc,
      employee.correoInstitucional,
    ]).filter((value) => typeof value === "string" && value.length > 0);
    addCheck(
      "Sin RFC ni correos de empleados",
      employeeIdentifiers.every((value) => !allText.includes(value)),
    );
  }
  addCheck("Sin ruta ../data", !allText.includes("../data"));
  addCheck("Sin extensiones DOCX/XLSX", !contents.some(({ file, text }) => /\.docx|\.xlsx/i.test(`${file}\n${text}`)));
  addCheck(
    "Incluye ruta de API",
    Boolean(apiBaseUrl && apiBaseUrl.endsWith("/api") && allText.includes(apiBaseUrl)),
  );

  console.table(checks);
  if (checks.some(({ Resultado }) => Resultado !== "OK")) process.exitCode = 1;
}