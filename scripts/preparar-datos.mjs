import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, FUENTES, ROOT } from "./datos.config.mjs";
import { parseVersionComparison } from "../src/features/policies/domain/parseVersionComparison.js";

const CHECK_ONLY = process.argv.slice(2).includes("--check");
const args = process.argv.slice(2);
const OMITTED_EMPLOYEE_FIELDS = new Set([
  "salarioMensualMXN",
  "rfc",
  "fechaNacimiento",
  "password",
  "telefonoMovil",
  "correoInstitucional",
]);
const PROVIDER_FIELDS = [
  "idProveedor",
  "razonSocial",
  "nombreComercial",
  "rfc",
  "categoria",
  "idEmpleadoComprador",
];
const MANAGED_DIRECTORIES = [
  "src/data/source",
  "src/features/auth/data",
  "src/data/conocimiento",
  "public/facturas-prueba",
  "api/data",
  "api/src/prompts",
];
const EXEMPT_FROM_STALE_CHECK = new Set([
  path.join("src", "data", "source", "unificacion.json"),
  path.join("src", "data", "source", "ventas-conciliacion.json"),
  path.join("api", "src", "prompts", "tools.js"),
]);

function sourcePath(name) {
  return path.join(DATA_DIR, FUENTES[name]);
}

function findSourceFile(root, fileName) {
  const matches = [];
  const pending = [root];
  while (pending.length) {
    const directory = pending.pop();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const currentPath = path.join(directory, entry.name);
      if (entry.isDirectory()) pending.push(currentPath);
      else if (entry.isFile() && entry.name === fileName) matches.push(currentPath);
    }
  }
  if (matches.length !== 1) {
    throw new Error(
      matches.length
        ? `Se esperaba un solo ${fileName} en ${root}; se encontraron ${matches.length}.`
        : `No se encontró ${fileName} dentro de ${root}.`,
    );
  }
  return matches[0];
}

function outputPath(relativePath) {
  return path.join(ROOT, relativePath);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`No se pudo leer el JSON ${filePath}: ${error.message}`);
  }
}

function readMarkdown(filePath) {
  const contents = fs.readFileSync(filePath, "utf8");
  return Buffer.from(contents.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n"), "utf8");
}

function jsonBuffer(value) {
  return Buffer.from(`${JSON.stringify(value, null, 1)}\n`, "utf8");
}

function addJsonOutput(outputs, relativePath, value, records) {
  outputs.set(relativePath, {
    contents: jsonBuffer(value),
    records: records ?? "",
  });
}

function ensureSources() {
  const requiredSources = [
    "sucursales",
    "empleados",
    "usuarios",
    "puestosRoles",
    "proveedores",
    "productos",
    "pedidos",
    "catalogosPedidos",
    "clientes",
    "existencias",
    "equivalenciasInventario",
    "excelInventarioDir",
    "quejas",
    "seedInvoices",
    "facturasPruebaDir",
    "politicasDir",
    "indicePoliticas",
  ];
  const missing = requiredSources
    .map((name) => ({ name, filePath: sourcePath(name) }))
    .filter(({ filePath }) => !fs.existsSync(filePath))
    .map(({ name, filePath }) => `${FUENTES[name]} (${filePath})`);
  if (fs.existsSync(sourcePath("politicasDir"))) {
    try {
      findSourceFile(sourcePath("politicasDir"), "CLAVE_comparacion_politicas.md");
    } catch (error) {
      missing.push(error.message);
    }
  }

  if (missing.length) {
    throw new Error(`Faltan fuentes de datos:\n- ${missing.join("\n- ")}`);
  }
}

async function makeOutputs() {
  const empleadosData = readJson(sourcePath("empleados"));
  const usuariosData = readJson(sourcePath("usuarios"));
  const puestosRolesData = readJson(sourcePath("puestosRoles"));
  const proveedoresData = readJson(sourcePath("proveedores"));
  const sucursalesData = readJson(sourcePath("sucursales"));
  const invoiceDir = sourcePath("facturasPruebaDir");
  const manifestPath = path.join(invoiceDir, "manifest.json");
  const invoiceManifest = readJson(manifestPath);
  const outputs = new Map();

  const sourceCopies = [
    ["clientes", "clientes"],
    ["pedidos", "pedidos"],
    ["existencias", "existencias"],
    ["quejas", "quejas"],
    ["productos", "catalogo-productos"],
    ["catalogosPedidos", "catalogos-pedidos"],
    ["seedInvoices", "seedInvoices"],
  ];
  for (const [sourceKey, outputName] of sourceCopies) {
    const data = readJson(sourcePath(sourceKey));
    const countKey = Object.keys(data).find((key) => Array.isArray(data[key]));
    addJsonOutput(
      outputs,
      `src/data/source/${outputName}.json`,
      data,
      countKey
        ? data[countKey].length
        : outputName === "catalogos-pedidos"
          ? Object.values(data).filter(Array.isArray).reduce((sum, records) => sum + records.length, 0)
          : "",
    );
  }

  const sanitizedProviders = proveedoresData.proveedores.map((provider) =>
    Object.fromEntries(PROVIDER_FIELDS.map((field) => [field, provider[field]])),
  );
  addJsonOutput(
    outputs,
    "src/data/source/proveedores-catalogo.json",
    { meta: proveedoresData.meta, proveedores: sanitizedProviders },
    sanitizedProviders.length,
  );

  const sanitizedEmployees = empleadosData.empleados.map((employee) =>
    Object.fromEntries(
      Object.entries(employee).filter(([field]) => !OMITTED_EMPLOYEE_FIELDS.has(field)),
    ),
  );
  addJsonOutput(
    outputs,
    "src/data/source/directorio.json",
    { empleados: sanitizedEmployees },
    sanitizedEmployees.length,
  );

  const clients = usuariosData.usuarios.filter((user) =>
    /^cliente(?:[1-9]|10)$/.test(user.usuario),
  );
  if (clients.length !== 10) {
    throw new Error(
      `Se esperaban las 10 cuentas cliente1 a cliente10 en ${FUENTES.usuarios}; se encontraron ${clients.length}.`,
    );
  }
  const employeeUsers = empleadosData.empleados.map((employee) => ({
    usuario: employee.usuario,
    password: employee.password,
    rol: employee.rolApp,
    nombre: `${employee.nombre} ${employee.apellidoPaterno}`,
    idEmpleado: employee.idEmpleado,
    idSucursal: employee.idSucursal,
    puesto: employee.puesto,
  }));
  addJsonOutput(
    outputs,
    "src/features/auth/data/usuarios.json",
    { usuarios: [...employeeUsers, ...clients] },
    employeeUsers.length + clients.length,
  );
  addJsonOutput(
    outputs,
    "src/features/auth/data/roles.json",
    { roles: puestosRolesData.rolesApp },
    puestosRolesData.rolesApp.length,
  );
  addJsonOutput(
    outputs,
    "api/data/usuarios.json",
    JSON.parse(outputs.get("src/features/auth/data/usuarios.json").contents.toString("utf8")),
    usuariosData.usuarios.length,
  );
  addJsonOutput(
    outputs,
    "api/data/roles.json",
    { roles: puestosRolesData.rolesApp },
    puestosRolesData.rolesApp.length,
  );
  addJsonOutput(
    outputs,
    "api/data/sucursales.json",
    {
      sucursales: sucursalesData.sucursales.map(({ id, nombre }) => ({ id, nombre })),
    },
    sucursalesData.sucursales.length,
  );
  const { SYSTEM_PROMPT } = await import("../src/features/chat/domain/guidelines.js");
  addJsonOutput(
    outputs,
    "api/src/prompts/system.json",
    { version: "1", systemPrompt: SYSTEM_PROMPT },
  );
  addJsonOutput(
    outputs,
    "src/config/sucursales.json",
    sucursalesData,
    sucursalesData.sucursales.length,
  );

  const manifestFiles = new Map(
    invoiceManifest.facturas.map((invoice) => [invoice.archivo, invoice.sha256]),
  );
  const invoiceFiles = fs.readdirSync(invoiceDir, { withFileTypes: true });
  const payloadFiles = invoiceFiles.filter(
    (entry) => entry.isFile() && entry.name !== "manifest.json",
  );
  if (payloadFiles.length !== invoiceManifest.facturas.length) {
    throw new Error(
      `El manifiesto declara ${invoiceManifest.facturas.length} facturas, pero se encontraron ${payloadFiles.length} archivos en ${FUENTES.facturasPruebaDir}.`,
    );
  }
  for (const entry of invoiceFiles) {
    if (!entry.isFile()) {
      throw new Error(`No se esperaba un directorio en ${FUENTES.facturasPruebaDir}: ${entry.name}`);
    }
    const sourceFile = path.join(invoiceDir, entry.name);
    const contents = fs.readFileSync(sourceFile);
    if (entry.name !== "manifest.json") {
      const expectedHash = manifestFiles.get(entry.name);
      if (!expectedHash) {
        throw new Error(`El archivo ${entry.name} no está declarado en manifest.json.`);
      }
      const actualHash = crypto.createHash("sha256").update(contents).digest("hex");
      if (actualHash !== expectedHash) {
        throw new Error(`El SHA-256 de ${entry.name} no coincide con manifest.json.`);
      }
    }
    outputs.set(`public/facturas-prueba/${entry.name}`, {
      contents,
      records: "",
    });
  }
  if (payloadFiles.some((entry) => !manifestFiles.has(entry.name))) {
    throw new Error("Hay archivos de facturas de prueba que no están declarados en manifest.json.");
  }

  const policiesDir = sourcePath("politicasDir");
  const comparisonPath = findSourceFile(policiesDir, "CLAVE_comparacion_politicas.md");
  for (const directory of [policiesDir, path.join(policiesDir, "md")]) {
    if (!fs.existsSync(directory)) continue;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (
        entry.isFile()
        && entry.name.toLowerCase().endsWith(".md")
        && !outputs.has(`src/data/conocimiento/${entry.name}`)
      ) {
        outputs.set(`src/data/conocimiento/${entry.name}`, {
          contents: readMarkdown(path.join(directory, entry.name)),
          records: "",
        });
      }
    }
  }
  addJsonOutput(
    outputs,
    "src/data/conocimiento/indice-politicas.json",
    readJson(sourcePath("indicePoliticas")),
    readJson(sourcePath("indicePoliticas")).politicas.length,
  );
  const comparisonMarkdown = readMarkdown(comparisonPath).toString("utf8");
  const comparison = parseVersionComparison(comparisonMarkdown);
  addJsonOutput(
    outputs,
    "src/data/source/devoluciones-versiones.json",
    comparison,
    comparison.contradicciones.length,
  );
  const configuredComparisonPath = sourcePath("comparacionPoliticas");
  if (fs.existsSync(configuredComparisonPath)) {
    outputs.set("src/data/conocimiento/comparacion-devoluciones.md", {
      contents: readMarkdown(configuredComparisonPath),
      records: "",
    });
  }

  return outputs;
}

function validateSensitiveData(outputs) {
  const usersPath = "src/features/auth/data/usuarios.json";
  const apiUsersPath = "api/data/usuarios.json";
  const generatedFiles = [...outputs.entries()];
  const users = JSON.parse(outputs.get(usersPath).contents.toString("utf8")).usuarios;
  const employeeRfc = new Set(
    readJson(sourcePath("empleados")).empleados.map((employee) => employee.rfc),
  );
  const employeePasswords = new Set(
    readJson(sourcePath("empleados")).empleados.map((employee) => employee.password),
  );
  const problems = [];

  for (const [relativePath, output] of generatedFiles) {
    if (
      !relativePath.startsWith("src/")
      && !relativePath.startsWith("public/")
      && !relativePath.startsWith("api/")
    ) continue;
    const text = output.contents.toString("utf8");
    if (text.includes("salarioMensualMXN")) {
      problems.push(`${relativePath} contiene salarioMensualMXN.`);
    }
    if (relativePath !== usersPath && relativePath !== apiUsersPath) {
      for (const rfc of employeeRfc) {
        if (rfc && text.includes(rfc)) {
          problems.push(`${relativePath} contiene el RFC de un empleado.`);
          break;
        }
      }
      for (const password of employeePasswords) {
        if (password && text.includes(password)) {
          problems.push(`${relativePath} contiene una contraseña de empleado.`);
          break;
        }
      }
    }
  }
  if (!Array.isArray(users)) {
    problems.push(`${usersPath} no contiene un arreglo de usuarios.`);
  }
  if (problems.length) {
    throw new Error(`La validación de datos sensibles falló:\n- ${problems.join("\n- ")}`);
  }
}

function validateWorkspaceFiles() {
  const usersPath = path.resolve(ROOT, "src", "features", "auth", "data", "usuarios.json");
  const employees = readJson(sourcePath("empleados")).empleados;
  const employeeRfc = employees.map((employee) => employee.rfc).filter(Boolean);
  const employeePasswords = employees.map((employee) => employee.password).filter(Boolean);
  const problems = [];

  for (const directory of ["src", "public", "api"]) {
    const root = outputPath(directory);
    const pending = [root];
    while (pending.length) {
      const current = pending.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const filePath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules") continue;
          pending.push(filePath);
          continue;
        }
        const text = fs.readFileSync(filePath, "utf8");
        if (text.includes("salarioMensualMXN")) {
          problems.push(`${path.relative(ROOT, filePath)} contiene salarioMensualMXN.`);
        }
        const relativePath = path.relative(ROOT, filePath);
        if (
          path.resolve(filePath) !== usersPath
          && relativePath !== path.join("api", "data", "usuarios.json")
        ) {
          if (employeeRfc.some((rfc) => text.includes(rfc))) {
            problems.push(`${path.relative(ROOT, filePath)} contiene el RFC de un empleado.`);
          }
          if (employeePasswords.some((password) => text.includes(password))) {
            problems.push(`${path.relative(ROOT, filePath)} contiene una contraseña de empleado.`);
          }
        }
      }
    }
  }
  if (problems.length) {
    throw new Error(`La validación del espacio de trabajo falló:\n- ${problems.join("\n- ")}`);
  }
}

function showSummary(outputs) {
  const rows = [...outputs].map(([relativePath, output]) => ({
    archivo: relativePath,
    registros: output.records,
    tamaño: output.contents.length,
  }));
  console.table(rows);
}

function findStaleFiles(outputs) {
  const expectedFilesByDirectory = new Map();
  for (const relativePath of outputs.keys()) {
    const directory = path.dirname(relativePath);
    if (!expectedFilesByDirectory.has(directory)) {
      expectedFilesByDirectory.set(directory, new Set());
    }
    expectedFilesByDirectory.get(directory).add(path.basename(relativePath));
  }

  const staleFiles = [];
  for (const relativeDirectory of MANAGED_DIRECTORIES) {
    const directory = outputPath(relativeDirectory);
    if (!fs.existsSync(directory)) continue;
    const expectedFiles = expectedFilesByDirectory.get(relativeDirectory) || new Set();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const relativePath = path.join(relativeDirectory, entry.name);
      if (
        entry.isFile()
        && !expectedFiles.has(entry.name)
        && !EXEMPT_FROM_STALE_CHECK.has(relativePath)
      ) {
        staleFiles.push(relativePath);
      }
    }
  }
  return staleFiles;
}

function writeFileAtomically(destination, contents) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  try {
    fs.writeFileSync(temporary, contents, { flag: "wx" });
    fs.renameSync(temporary, destination);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

async function run() {
  if (args.some((arg) => arg !== "--check") || args.filter((arg) => arg === "--check").length > 1) {
    throw new Error("Uso: node scripts/preparar-datos.mjs [--check]");
  }
  ensureSources();
  const outputs = await makeOutputs();
  validateSensitiveData(outputs);

  const staleFiles = findStaleFiles(outputs);
  for (const [relativePath, output] of outputs) {
    const destination = outputPath(relativePath);
    if (CHECK_ONLY) {
      if (
        !fs.existsSync(destination) ||
        !(
          relativePath.toLowerCase().endsWith(".md")
            ? readMarkdown(destination)
            : fs.readFileSync(destination)
        ).equals(output.contents)
      ) {
        staleFiles.push(relativePath);
      }
    } else {
      writeFileAtomically(destination, output.contents);
    }
  }
  if (!CHECK_ONLY) {
    for (const relativePath of staleFiles) {
      fs.unlinkSync(outputPath(relativePath));
    }
  }
  showSummary(outputs);
  if (staleFiles.length) {
    console.error(`Archivos desactualizados o faltantes:\n- ${staleFiles.join("\n- ")}`);
    process.exitCode = 1;
    return;
  }
  if (CHECK_ONLY) console.log("Los datos generados están actualizados.");
  validateWorkspaceFiles();
}

try {
  await run();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
