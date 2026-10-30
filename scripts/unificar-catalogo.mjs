import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, ROOT, FUENTES } from "./datos.config.mjs";
import {
  inferBranchConventions,
  matchProduct,
  normalizeName,
  parsePrice,
} from "../src/features/catalog/domain/catalogMatching.js";

const CHECK_ONLY = process.argv.includes("--check");
const OUTPUT_PATH = path.join(ROOT, "src", "data", "source", "unificacion.json");
const BRANCHES = [
  { id: "gdl", patterns: [/guadalajara/i], label: "Guadalajara" },
  { id: "zap", patterns: [/zapopan/i], label: "Zapopan" },
  { id: "leo", patterns: [/leon/i], label: "León" },
  { id: "qro", patterns: [/queretaro/i], label: "Querétaro" },
  { id: "ags", patterns: [/aguascalientes/i, /ags/i], label: "Aguascalientes" },
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
  ["presentacion", "presentacion"],
  ["pres", "presentacion"],
  ["medida", "presentacion"],
  ["unidad", "unidad"],
  ["precio venta", "precio"],
  ["precio c iva", "precio"],
  ["precio lista", "precio"],
  ["p unit", "precio"],
  ["precio", "precio"],
  ["con iva", "precioConIVA"],
  ["existencia", "existencia"],
  ["stock", "existencia"],
  ["cantidad en bodega", "existencia"],
  ["exist", "existencia"],
  ["cantidad", "existencia"],
  ["apartado", "apartado"],
]);

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`No se pudo leer ${filePath}: ${error.message}`);
  }
}

function normalizeHeader(value) {
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
  return value === null || value === undefined
    ? ""
    : String(value).trim().replace(/\s+/g, " ");
}

function parseQuantity(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = displayText(value).replace(/,/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function sourceDirectory() {
  const inventoryRoot = path.join(DATA_DIR, "Inventario");
  const candidates = [
    path.join(inventoryRoot, "excel_sucursales"),
    path.join(DATA_DIR, FUENTES.excelInventarioDir),
    path.join(inventoryRoot, "Inventario_old"),
  ];
  return candidates.find((candidate) => {
    if (!fs.existsSync(candidate)) return false;
    const pending = [candidate];
    while (pending.length) {
      const current = pending.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        if (entry.isFile() && /\.xlsx?$/i.test(entry.name)) return true;
        if (entry.isDirectory()) pending.push(path.join(current, entry.name));
      }
    }
    return false;
  });
}

function findExcelFiles(directory) {
  if (!directory) {
    throw new Error(
      "No se encontró la carpeta de Excel data/Inventario/excel_sucursales ni Inventario_old.",
    );
  }
  const files = [];
  const pending = [directory];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const filePath = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(filePath);
      else if (entry.isFile() && /\.xlsx?$/i.test(entry.name)) files.push(filePath);
    }
  }

  const byBranch = new Map();
  for (const branch of BRANCHES) {
    const match = files.find((filePath) =>
      branch.patterns.some((pattern) => pattern.test(path.basename(filePath))),
    );
    if (!match) throw new Error(`No se encontró el Excel de ${branch.label} en ${directory}.`);
    byBranch.set(branch.id, match);
  }
  return byBranch;
}

function headerColumns(worksheet) {
  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const columns = new Map();
    row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
      const field = HEADER_ALIASES.get(normalizeHeader(cellValue(cell)));
      if (field && !columns.has(field)) columns.set(field, columnNumber);
    });
    if (columns.has("producto") && columns.size >= 3) {
      return { rowNumber, columns };
    }
  }
  return null;
}

function isTotal(value) {
  return normalizeName(value) === "total";
}

function readWorksheetRows(worksheet, branchId, filePath) {
  const header = headerColumns(worksheet);
  if (!header) return { rows: [], foundHeader: false };
  const rows = [];
  for (let rowNumber = header.rowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const sourceRow = worksheet.getRow(rowNumber);
    const valueFor = (field) => {
      const column = header.columns.get(field);
      return column ? cellValue(sourceRow.getCell(column)) : null;
    };
    const nombrePublicado = displayText(valueFor("producto"));
    const codigo = valueFor("codigo");
    if ((!nombrePublicado && !codigo) || isTotal(nombrePublicado)) continue;
    if (!nombrePublicado) continue;

    rows.push({
      sucursal: branchId,
      archivo: path.basename(filePath),
      hoja: worksheet.name,
      fila: rowNumber,
      codigo: codigo === null || codigo === undefined ? null : codigo,
      nombrePublicado,
      presentacion: displayText(valueFor("presentacion")),
      unidad: displayText(valueFor("unidad")),
      precioPublicado: parsePrice(valueFor("precio")),
      precioConIVA: parsePrice(valueFor("precioConIVA")),
      existenciaPublicada: parseQuantity(valueFor("existencia")),
      apartadoPublicado: parseQuantity(valueFor("apartado")),
    });
  }
  return { rows, foundHeader: true };
}

async function readBranchWorkbook(branchId, filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const rows = [];
  const sheets = [];
  for (const worksheet of workbook.worksheets) {
    const parsed = readWorksheetRows(worksheet, branchId, filePath);
    if (!parsed.foundHeader) continue;
    sheets.push(worksheet.name);
    rows.push(...parsed.rows);
  }
  return { rows, sheets };
}

function roundMoney(value) {
  return Number(Number(value).toFixed(2));
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined))];
}

function resolveRows(rows, catalogo) {
  return rows.map((row) => ({
    ...row,
    resultado: matchProduct(row, catalogo),
  }));
}

function buildProductRecords(catalogo, branchRows, conventions, existencias) {
  const stockByKey = new Map(existencias.map((item) => [
    `${item.idSucursal}:${item.claveProducto}`,
    item,
  ]));

  return catalogo.map((product) => {
    const porSucursal = {};
    for (const branch of BRANCHES) {
      const row = branchRows.get(branch.id).find(
        (item) => item.resultado.clave === product.claveProducto,
      );
      if (!row) continue;
      const convention = conventions.get(branch.id);
      const reference = stockByKey.get(`${branch.id}:${product.claveProducto}`);
      const price = row.precioPublicado;
      const existenciaComparable = convention.existenciaSignifica === "fisica"
        ? row.existenciaPublicada
        : convention.existenciaSignifica === "disponible" && reference
          ? row.existenciaPublicada + reference.comprometido
          : null;
      porSucursal[branch.id] = {
        codigo: row.codigo,
        nombrePublicado: row.nombrePublicado,
        unidad: row.unidad || row.presentacion,
        precioPublicado: price,
        precioSinIVA: price === null
          ? null
          : roundMoney(price / convention.factorPrecio),
        existenciaPublicada: row.existenciaPublicada,
        existenciaComparable,
        metodo: row.resultado.metodo,
        puntaje: row.resultado.puntaje,
      };
    }
    const branchValues = Object.values(porSucursal);
    const publicPrices = branchValues
      .map((row) => row.precioPublicado)
      .filter((value) => value !== null);
    const normalizedPrices = branchValues
      .map((row) => row.precioSinIVA)
      .filter((value) => value !== null);
    const priceRange = publicPrices.length
      ? { min: Math.min(...publicPrices), max: Math.max(...publicPrices) }
      : { min: null, max: null };
    const normalizedNameCount = unique(branchValues.map((row) => row.nombrePublicado)).length;
    return {
      claveProducto: product.claveProducto,
      nombreCatalogo: product.nombre,
      porSucursal,
      contradicciones: {
        nombresDistintos: normalizedNameCount,
        preciosPublicadosDistintos: unique(publicPrices).length > 1,
        rangoPreciosPublicados: priceRange,
        preciosNormalizadosDistintos: unique(normalizedPrices).length > 1,
        existenciasPublicadasDistintas: unique(
          branchValues.map((row) => row.existenciaPublicada),
        ).length > 1,
      },
    };
  });
}

function buildOutput(branches, catalogo, existencias) {
  const branchRows = new Map();
  const conventions = new Map();
  const outputBranches = {};
  const revision = [];
  let filasTotales = 0;
  let resueltas = 0;

  for (const branch of BRANCHES) {
    const source = branches.get(branch.id);
    const resolved = resolveRows(source.rows, catalogo);
    const matched = resolved.filter((row) => row.resultado.clave);
    const convention = inferBranchConventions(
      matched.map((row) => ({
        ...row,
        clave: row.resultado.clave,
      })),
      catalogo,
      existencias.filter((item) => item.idSucursal === branch.id),
    );
    conventions.set(branch.id, convention);
    branchRows.set(branch.id, resolved);
    filasTotales += resolved.length;
    resueltas += matched.length;
    outputBranches[branch.id] = {
      archivo: path.basename(source.filePath),
      hojas: source.sheets,
      filasLeidas: resolved.length,
      filasResueltas: matched.length,
      filasEnRevision: resolved.length - matched.length,
      convenciones: convention,
    };
    for (const row of resolved) {
      if (row.resultado.clave) continue;
      revision.push({
        sucursal: branch.id,
        archivo: row.archivo,
        hoja: row.hoja,
        fila: row.fila,
        codigo: row.codigo,
        nombrePublicado: row.nombrePublicado,
        mejorCandidato: row.resultado.mejorCandidato,
        puntaje: row.resultado.puntaje,
      });
    }
  }

  const productos = buildProductRecords(catalogo, branchRows, conventions, existencias);
  const productosConAlMenos2Nombres = productos.filter(
    (product) => product.contradicciones.nombresDistintos >= 2,
  ).length;
  const productosConPreciosPublicadosDistintos = productos.filter(
    (product) => product.contradicciones.preciosPublicadosDistintos,
  ).length;
  return {
    meta: {
      descripcion: "Unificación determinista de los inventarios de cinco sucursales contra el catálogo único.",
      fuente: "data/Inventario/* y src/data/source/catalogo-productos.json",
      totalSucursales: BRANCHES.length,
      totalProductos: catalogo.length,
      totalFilas: filasTotales,
    },
    sucursales: outputBranches,
    productos,
    revision,
    resumen: {
      filasTotales,
      resueltas,
      enRevision: filasTotales - resueltas,
      porcentajeResueltas: filasTotales
        ? Number(((resueltas / filasTotales) * 100).toFixed(2))
        : 0,
      productosConAlMenos2Nombres,
      productosConPreciosPublicadosDistintos,
    },
  };
}

function jsonBuffer(value) {
  return Buffer.from(`${JSON.stringify(value, null, 1)}\n`, "utf8");
}

function printSummary(result) {
  console.table(BRANCHES.map((branch) => ({
    sucursal: branch.label,
    leidas: result.sucursales[branch.id].filasLeidas,
    resueltas: result.sucursales[branch.id].filasResueltas,
    enRevision: result.sucursales[branch.id].filasEnRevision,
    precioIVA: result.sucursales[branch.id].convenciones.precioIncluyeIVA,
    existencia: result.sucursales[branch.id].convenciones.existenciaSignifica,
  })));
  console.log(
    `Total: ${result.resumen.filasTotales} filas; ${result.resumen.resueltas} resueltas (${result.resumen.porcentajeResueltas}%); ${result.resumen.enRevision} en Revisar.`,
  );
  if (result.revision.length) {
    console.info("En Revisar:", result.revision.map((row) =>
      `${row.sucursal}/${row.nombrePublicado} → ${row.mejorCandidato?.nombre || "sin candidato"}`,
    ));
  }
}

async function main() {
  const sourcePath = sourceDirectory();
  const inputFiles = findExcelFiles(sourcePath);
  const catalogo = readJson(path.join(ROOT, "src", "data", "source", "catalogo-productos.json")).productos;
  const existencias = readJson(path.join(ROOT, "src", "data", "source", "existencias.json")).existencias;
  const branchData = new Map();
  for (const branch of BRANCHES) {
    const filePath = inputFiles.get(branch.id);
    branchData.set(branch.id, {
      filePath,
      ...await readBranchWorkbook(branch.id, filePath),
    });
  }
  const result = buildOutput(branchData, catalogo, existencias);
  const expected = jsonBuffer(result);

  if (CHECK_ONLY) {
    const current = fs.existsSync(OUTPUT_PATH) ? fs.readFileSync(OUTPUT_PATH) : null;
    if (!current || !current.equals(expected)) {
      console.error("src/data/source/unificacion.json está desactualizado. Ejecuta npm run catalogo:unificar.");
      process.exitCode = 1;
    } else {
      console.log("La unificación del catálogo está actualizada.");
    }
  } else {
    fs.writeFileSync(OUTPUT_PATH, expected);
    console.log("Se generó src/data/source/unificacion.json.");
  }
  printSummary(result);
}

main().catch((error) => {
  console.error(`No se pudo unificar el catálogo: ${error.message}`);
  process.exitCode = 1;
});
