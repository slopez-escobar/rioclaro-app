import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = process.env.RC_DATA_DIR
  ? path.resolve(process.env.RC_DATA_DIR)
  : path.resolve(APP_ROOT, "..", "data");
const SENSITIVE_KEYS = [
  "salarioMensualMXN",
  "fechaNacimiento",
  "correoInstitucional",
  "telefonoMovil",
];

function filesUnder(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(filePath) : [filePath];
  });
}

function textContents(files) {
  return files.map((filePath) => ({
    filePath,
    text: fs.readFileSync(filePath).toString("utf8"),
  }));
}

function findEmployeeData() {
  return filesUnder(DATA_DIR).filter((filePath) => {
    const name = path.basename(filePath).toLowerCase();
    return name === "empleados.json" || name === "rioclaro_empleados.json";
  });
}

const employeeFiles = findEmployeeData();
if (!employeeFiles.length) {
  console.info("Seguridad del paquete: no se encontró un archivo empleados.json en DATA_DIR; se omite la comparación de identificadores.");
}

describe("seguridad del paquete", () => {
  it("no incluye claves de datos personales o salariales en src ni public", () => {
    const bundleFiles = [...filesUnder(path.join(APP_ROOT, "src")), ...filesUnder(path.join(APP_ROOT, "public"))];
    for (const { filePath, text } of textContents(bundleFiles)) {
      for (const key of SENSITIVE_KEYS) {
        expect(text, `Clave sensible encontrada en ${path.relative(APP_ROOT, filePath)}`).not.toContain(key);
      }
    }
  });

  it("mantiene las contraseñas de demostración únicamente en el fixture local requerido", () => {
    const expectedFile = path.join(APP_ROOT, "src", "features", "auth", "data", "usuarios.json");
    // Esta excepción es intencional: el prototipo local necesita credenciales de demostración; en B2 se retiran del paquete.
    const credentialFiles = textContents(filesUnder(path.join(APP_ROOT, "src")))
      .filter(({ text }) => text.includes("demo123"))
      .map(({ filePath }) => path.resolve(filePath));
    expect(credentialFiles).toEqual([path.resolve(expectedFile)]);
  });

  if (employeeFiles.length) {
    it("no publica los RFC ni correos institucionales del padrón de empleados", () => {
      expect(employeeFiles).toHaveLength(1);
      const source = JSON.parse(fs.readFileSync(employeeFiles[0], "utf8"));
      const employees = source.empleados || [];
      expect(employees).toHaveLength(140);
      const identifiers = employees.flatMap((employee) => [
        employee.rfc,
        employee.correoInstitucional,
      ]).filter((value) => typeof value === "string" && value.length > 0);
      const scannedFiles = [
        ...filesUnder(path.join(APP_ROOT, "src")),
        ...filesUnder(path.join(APP_ROOT, "public")),
        ...filesUnder(path.join(APP_ROOT, "dist")),
      ];
      const identifierPattern = new RegExp(
        identifiers.map((identifier) => identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
      );
      const containsIdentifier = textContents(scannedFiles)
        .some(({ text }) => identifierPattern.test(text));
      expect(containsIdentifier, "Se detectaron identificadores del personal dentro del paquete.").toBe(false);
    }, 30000);
  }

  if (fs.existsSync(path.join(APP_ROOT, "dist"))) {
    it("no incluye referencias a ../data ni documentos originales en dist", () => {
      const files = filesUnder(path.join(APP_ROOT, "dist"));
      for (const { filePath, text } of textContents(files)) {
        expect(text, `Referencia a ../data en ${path.relative(APP_ROOT, filePath)}`).not.toContain("../data");
        expect(path.extname(filePath).toLowerCase()).not.toMatch(/^\.(docx|xlsx)$/);
      }
    });
  }
});
