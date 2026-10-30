import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DATA_DIR, FUENTES, ROOT } from "./helpers/paths.js";

const usersPath = path.join(ROOT, "src", "features", "auth", "data", "usuarios.json");
const users = JSON.parse(fs.readFileSync(usersPath, "utf8")).usuarios;
const employeeUsers = users.filter((user) => user.idEmpleado);
const clientUsers = users.filter((user) => user.idCliente);

function filesRecursively(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? filesRecursively(fullPath) : [fullPath];
  });
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

describe("sincronización de datos", () => {
  it.skipIf(!fs.existsSync(DATA_DIR))(
    "omite la comprobación --check porque no está disponible data/ en este entorno",
    () => {
      execFileSync(
        process.execPath,
        [path.join(ROOT, "scripts", "preparar-datos.mjs"), "--check"],
        { cwd: ROOT, stdio: "pipe" },
      );
    },
    15_000,
  );

  it("no publica salarios, contraseñas ni RFC de empleados fuera de usuarios.json", () => {
    const employeeDataPath = path.join(DATA_DIR, FUENTES.empleados);
    const employeeData = fs.existsSync(employeeDataPath)
      ? JSON.parse(fs.readFileSync(employeeDataPath, "utf8"))
      : null;
    const employeeRfc = employeeData
      ? employeeData.empleados.map((employee) => employee.rfc).filter(Boolean)
      : [];
    const employeePasswords = employeeData
      ? employeeData.empleados.map((employee) => employee.password).filter(Boolean)
      : [];
    const generatedFiles = [
      ...filesRecursively(path.join(ROOT, "src")),
      ...filesRecursively(path.join(ROOT, "public")),
    ];
    const usersFile = path.resolve(usersPath);

    for (const filePath of generatedFiles) {
      const text = fs.readFileSync(filePath, "utf8");
      expect(text, path.relative(ROOT, filePath)).not.toContain("salarioMensualMXN");
      if (path.resolve(filePath) !== usersFile) {
        for (const password of employeePasswords) {
          expect(text, path.relative(ROOT, filePath)).not.toContain(password);
        }
        for (const rfc of employeeRfc) {
          expect(text, path.relative(ROOT, filePath)).not.toContain(rfc);
        }
      }
    }
  }, 15_000);

  it("incluye los 11 archivos verificados por el manifiesto", () => {
    const directory = path.join(ROOT, "public", "facturas-prueba");
    const manifest = JSON.parse(
      fs.readFileSync(path.join(directory, "manifest.json"), "utf8"),
    );
    const invoiceFiles = manifest.facturas;

    expect(invoiceFiles).toHaveLength(11);
    for (const invoice of invoiceFiles) {
      const contents = fs.readFileSync(path.join(directory, invoice.archivo));
      const hash = crypto.createHash("sha256").update(contents).digest("hex");
      expect(hash, invoice.archivo).toBe(invoice.sha256);
    }
  });

  it("contiene 140 cuentas de empleados y 10 de clientes", () => {
    expect(employeeUsers).toHaveLength(140);
    expect(clientUsers).toHaveLength(10);
  });

  it("conserva los conteos de los catálogos y datos iniciales", () => {
    expect(readJson("src/data/source/clientes.json").clientes).toHaveLength(2000);
    expect(readJson("src/data/source/pedidos.json").pedidos).toHaveLength(3000);
    expect(readJson("src/data/source/existencias.json").existencias).toHaveLength(320);
    expect(readJson("src/data/source/quejas.json").quejas).toHaveLength(221);
    expect(readJson("src/data/source/catalogo-productos.json").productos).toHaveLength(64);
    expect(readJson("src/data/source/proveedores-catalogo.json").proveedores).toHaveLength(60);
    expect(readJson("src/data/source/seedInvoices.json").facturas).toHaveLength(9);
    expect(
      fs
        .readdirSync(path.join(ROOT, "src", "data", "conocimiento"))
        .filter((name) => /^POL-.*\.md$/i.test(name)),
    ).toHaveLength(13);
  });
});
