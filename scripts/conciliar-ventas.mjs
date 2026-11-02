import ExcelJS from "exceljs";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, ROOT } from "./datos.config.mjs";
import {
  explainDifference,
  hypothesisTotals,
} from "../src/features/sales/domain/salesReconciliation.js";
import { matchProduct } from "../src/features/catalog/domain/catalogMatching.js";

const OUTPUT_PATH = path.join(ROOT, "src", "data", "source", "ventas-conciliacion.json");
const CHECK_ONLY = process.argv.includes("--check");
const BRANCHES = [
  { id: "gdl", nombre: "Guadalajara", pattern: /guadalajara/i },
  { id: "zap", nombre: "Zapopan", pattern: /zapopan/i },
  { id: "leo", nombre: "León", pattern: /le[oó]n/i },
  { id: "qro", nombre: "Querétaro", pattern: /qro|quer[eé]taro/i },
  { id: "ags", nombre: "Aguascalientes", pattern: /ags|aguascalientes/i },
];
const HEADER_ALIASES = new Map([
  ["codigo", "codigo"],
  ["sku", "codigo"],
  ["clave", "codigo"],
  ["id", "codigo"],
  ["descripcion", "producto"],
  ["producto", "producto"],
  ["articulo", "producto"],
  ["nombre del producto", "producto"],
  ["piezas", "unidades"],
  ["cantidad", "unidades"],
  ["unidades", "unidades"],
  ["cant", "unidades"],
  ["venta", "importe"],
  ["importe sin iva", "importe"],
  ["total vendido", "importe"],
  ["venta c iva", "importe"],
  ["importe", "importe"],
]);

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function cellValue(cell) {
  const value = cell.value;
  if (value && typeof value === "object") {
    if ("result" in value) return value.result;
    if (Array.isArray(value.richText)) {
      return value.richText.map((item) => item.text).join("");
    }
    if ("text" in value) return value.text;
  }
  return value;
}

function displayText(value) {
  return value == null ? "" : String(value).trim().replace(/\s+/g, " ");
}

function parseNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = displayText(value)
    .replace(/[$€£]/g, "")
    .replace(/,/g, "")
    .replace(/\s/g, "");
  if (!cleaned) return null;
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : null;
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function catalogMatchRow(row) {
  const normalized = normalizeText(row.nombrePublicado);
  const generalDisinfectant = normalized.match(/^desinfectante uso general\s+(.+)$/);
  if (generalDisinfectant) {
    return {
      ...row,
      nombrePublicado: `Desinfectante multiusos ${generalDisinfectant[1]}`,
    };
  }
  const disinfectant = normalized.match(/^desinfectante\s+(.+)$/);
  if (disinfectant) {
    return { ...row, nombrePublicado: `Desinfectante multiusos ${disinfectant[1]}` };
  }
  const handSoap = normalized.match(/^jabon de manos\s+(.+)$/);
  if (handSoap) {
    return { ...row, nombrePublicado: `Jabón líquido para manos ${handSoap[1]}` };
  }
  return row;
}

function findHeader(worksheet) {
  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const columns = new Map();
    worksheet.getRow(rowNumber).eachCell({ includeEmpty: false }, (cell, column) => {
      const field = HEADER_ALIASES.get(normalizeText(cellValue(cell)));
      if (field && !columns.has(field)) columns.set(field, column);
    });
    if (columns.has("producto") && columns.has("unidades") && columns.has("importe")) {
      return { rowNumber, columns };
    }
  }
  return null;
}

function isTotalRow(row) {
  return row.values.some((value) => /^(total(?: general)?|suma)(?:\s|$)/.test(normalizeText(value)));
}

function readWorksheet(worksheet, filePath, branch) {
  const header = findHeader(worksheet);
  if (!header) return null;
  const rows = [];
  let declaredTotal = null;
  for (let rowNumber = header.rowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    if (isTotalRow(row)) {
      declaredTotal = parseNumber(
        cellValue(row.getCell(header.columns.get("importe"))),
      );
      continue;
    }
    const valueFor = (field) => {
      const column = header.columns.get(field);
      return column ? cellValue(row.getCell(column)) : null;
    };
    const nombrePublicado = displayText(valueFor("producto"));
    const unidades = parseNumber(valueFor("unidades"));
    const importe = parseNumber(valueFor("importe"));
    const codigo = valueFor("codigo");
    if (unidades == null && importe == null) continue;
    if (!nombrePublicado && unidades == null && importe != null) continue;
    if (!nombrePublicado || unidades == null || importe == null) {
      throw new Error(
        `Fila incompleta en ${path.basename(filePath)} / ${worksheet.name}, fila ${rowNumber}.`,
      );
    }
    rows.push({
      archivo: path.basename(filePath).replace(/\.xlsx?$/i, ""),
      hoja: worksheet.name,
      fila: rowNumber,
      codigo: codigo == null ? null : displayText(codigo),
      nombrePublicado,
      unidades,
      importe: roundMoney(importe),
    });
  }
  return { rows, declaredTotal };
}

function findSalesFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    throw new Error(`No se encontró la carpeta de datos: ${DATA_DIR}`);
  }
  const files = [];
  const pending = [DATA_DIR];
  while (pending.length) {
    const directory = pending.pop();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        pending.push(filePath);
      } else if (
        entry.isFile()
        && /\.xlsx?$/i.test(entry.name)
        && normalizeText(path.relative(DATA_DIR, path.dirname(filePath))).includes("ventas")
      ) {
        files.push(filePath);
      }
    }
  }

  const result = new Map();
  for (const branch of BRANCHES) {
    const matches = files
      .filter((filePath) => branch.pattern.test(path.basename(filePath)))
      .sort((left, right) => left.localeCompare(right, "es-MX"));
    if (!matches.length) {
      throw new Error(`No se encontró el Excel de ventas de ${branch.nombre} en una carpeta "ventas" dentro de ${DATA_DIR}.`);
    }
    if (matches.length > 1) {
      throw new Error(`Se encontraron varios Excel de ventas para ${branch.nombre}: ${matches.join(", ")}.`);
    }
    result.set(branch.id, matches[0]);
  }
  return result;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (cause) {
    throw new Error(`No se pudo leer ${filePath}: ${cause.message}`);
  }
}

async function readBranch(branch, filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheets = workbook.worksheets
    .map((worksheet) => ({
      worksheet,
      parsed: readWorksheet(worksheet, filePath, branch),
    }))
    .filter((item) => item.parsed);
  if (worksheets.length !== 1) {
    throw new Error(
      `${path.basename(filePath)} debe contener una sola hoja con encabezados de ventas; se encontraron ${worksheets.length}.`,
    );
  }
  const [{ worksheet, parsed }] = worksheets;
  if (parsed.declaredTotal == null) {
    throw new Error(`No se encontró un total calculado en ${path.basename(filePath)} / ${worksheet.name}.`);
  }
  return {
    hoja: worksheet.name,
    filas: parsed.rows,
    totalDeclaradoEnElArchivo: roundMoney(parsed.declaredTotal),
  };
}

function buildOutput(branchInputs, pedidos, catalogo) {
  const unmatched = [];
  const sucursales = BRANCHES.map((branch) => {
    const input = branchInputs.get(branch.id);
    const resolved = input.filas.map((row) => {
      const result = matchProduct(catalogMatchRow(row), catalogo);
      if (!result.clave) unmatched.push({ sucursal: branch.nombre, ...row });
      return { ...row, claveProducto: result.clave };
    });
    const totalReportado = roundMoney(
      resolved.reduce((sum, row) => sum + row.importe, 0),
    );
    const totals = hypothesisTotals(pedidos, branch.id, "2026-09");
    const explicacion = explainDifference(totalReportado, totals);
    const diferencia = roundMoney(totalReportado - totals.correcta.total);
    const hipotesisProbadas = Object.fromEntries(
      Object.entries(totals)
        .filter(([name]) => name !== "correcta")
        .map(([name, value]) => [name, value]),
    );
    return {
      id: branch.id,
      nombre: branch.nombre,
      archivo: path.basename(input.filePath),
      hoja: input.hoja,
      filasLeidas: resolved.length,
      totalReportado,
      totalDeclaradoEnElArchivo: input.totalDeclaradoEnElArchivo,
      totalCorrecto: totals.correcta.total,
      diferencia,
      explicacion: {
        hipotesis: explicacion.hipotesis,
        descripcion: explicacion.descripcion,
        desglose: explicacion.desglose,
      },
      hipotesisProbadas,
    };
  });
  if (unmatched.length) {
    throw new Error(
      `Hay ${unmatched.length} filas de ventas en revisión; no se generó la conciliación:\n- ${
        unmatched.map((row) =>
          `${row.sucursal}/${row.archivo}/${row.hoja}/${row.fila}: ${row.nombrePublicado}`,
        ).join("\n- ")
      }`,
    );
  }
  const totalCorrecto = roundMoney(
    sucursales.reduce((sum, branch) => sum + branch.totalCorrecto, 0),
  );
  const sumaDeLosReportes = roundMoney(
    sucursales.reduce((sum, branch) => sum + branch.totalReportado, 0),
  );
  return {
    meta: {
      descripcion: "Conciliación de los reportes de ventas de septiembre de 2026 contra los pedidos registrados.",
      periodo: "2026-09",
      definicion: "Venta correcta: productos sin IVA por sucursal de venta y fecha del pedido; se excluyen cancelados y devueltos.",
    },
    sucursales,
    resumen: {
      totalCorrecto,
      sumaDeLosReportes,
      diferenciaGlobal: roundMoney(sumaDeLosReportes - totalCorrecto),
      sucursalesExplicadas: sucursales.filter(
        (branch) => branch.explicacion.hipotesis !== null,
      ).length,
    },
  };
}

function jsonBuffer(value) {
  const stripExtensions = (item) => {
    if (typeof item === "string") return item.replace(/\.(docx|xlsx)\b/gi, "");
    if (Array.isArray(item)) return item.map(stripExtensions);
    if (item && typeof item === "object") {
      return Object.fromEntries(Object.entries(item).map(([key, nested]) => [key, stripExtensions(nested)]));
    }
    return item;
  };
  return Buffer.from(`${JSON.stringify(stripExtensions(value), null, 1)}\n`, "utf8");
}

function writeAtomically(destination, contents) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, contents, { flag: "wx" });
    fs.renameSync(temporary, destination);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--check") || args.filter((arg) => arg === "--check").length > 1) {
    throw new Error("Uso: node scripts/conciliar-ventas.mjs [--check]");
  }
  const files = findSalesFiles();
  const catalogo = readJson(path.join(ROOT, "src", "data", "source", "catalogo-productos.json")).productos;
  const pedidos = readJson(path.join(ROOT, "src", "data", "source", "pedidos.json")).pedidos;
  const branchInputs = new Map();
  for (const branch of BRANCHES) {
    const filePath = files.get(branch.id);
    branchInputs.set(branch.id, {
      filePath,
      ...await readBranch(branch, filePath),
    });
  }
  const result = buildOutput(branchInputs, pedidos, catalogo);
  const expected = jsonBuffer(result);
  const summary = result.sucursales.map((branch) => ({
    sucursal: branch.nombre,
    filas: branch.filasLeidas,
    reportado: branch.totalReportado,
    correcto: branch.totalCorrecto,
    diferencia: branch.diferencia,
    hipotesis: branch.explicacion.hipotesis || "Sin explicar",
  }));
  console.log(`Reportes encontrados en: ${path.relative(DATA_DIR, path.dirname(files.get("gdl")))}`);
  console.table(summary);
  if (CHECK_ONLY) {
    const current = fs.existsSync(OUTPUT_PATH) ? fs.readFileSync(OUTPUT_PATH) : null;
    if (!current || !current.equals(expected)) {
      console.error("src/data/source/ventas-conciliacion.json está desactualizado. Ejecuta npm run ventas:conciliar.");
      process.exitCode = 1;
    } else {
      console.log("La conciliación de ventas está actualizada.");
    }
    return;
  }
  writeAtomically(OUTPUT_PATH, expected);
  console.log("Se generó src/data/source/ventas-conciliacion.json.");
}

main().catch((cause) => {
  console.error(`No se pudo conciliar ventas: ${cause.message}`);
  process.exitCode = 1;
});
