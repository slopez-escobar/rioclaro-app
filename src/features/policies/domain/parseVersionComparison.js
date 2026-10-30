const VERSION_KEYS = ["v1", "leon", "v3"];
const VERSION_LABELS = ["v1 (2018)", "León (2022)", "v3 (2024)"];

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX")
    .replace(/[^a-z0-9]+/g, "");
}

function clean(value) {
  return String(value ?? "")
    .replace(/\*\*/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

function cells(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "")
    .split("|").map((cell) => clean(cell));
}

function isSeparator(line) {
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(line);
}

function findTable(lines, expectedHeaders) {
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].includes("|")) continue;
    const header = cells(lines[index]).map(normalize);
    if (!expectedHeaders.every((item) => header.includes(item))) continue;
    const rows = [];
    for (let rowIndex = index + 1; rowIndex < lines.length; rowIndex += 1) {
      const line = lines[rowIndex].trim();
      if (!line.startsWith("|")) break;
      if (isSeparator(line)) continue;
      const row = cells(line);
      if (row.length === header.length) {
        rows.push(Object.fromEntries(header.map((name, cellIndex) => [name, row[cellIndex]])));
      }
    }
    return rows;
  }
  return null;
}

function parseNote(lines) {
  const heading = lines.findIndex((line) =>
    /^##\s+/.test(line) && normalize(line.replace(/^##\s+/, "")) === "versionqueseproponecomovigente",
  );
  if (heading < 0) return null;
  const content = [];
  for (let index = heading + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index])) break;
    if (lines[index].trim()) content.push(clean(lines[index].replace(/^\s*>\s?/, "")));
  }
  return content.join(" ").trim();
}

/**
 * Analiza las tablas internas que documentan las versiones de la política de devoluciones.
 * @param {string} markdown Contenido de la clave de comparación.
 * @returns {Object} Comparación normalizada para su publicación en la app.
 */
export function parseVersionComparison(markdown) {
  const lines = String(markdown ?? "")
    .split(/\r?\n/)
    .filter((line) => !/^>\s*Solo para quien eval[uú]a\b/i.test(line.trim()));
  const versionRows = findTable(lines, [
    "archivo",
    "versioninterna",
    "fecha",
    "elaboro",
    "aplicaa",
  ]);
  if (!versionRows) {
    throw new Error("No se encontró la tabla de versiones de la política de devoluciones.");
  }
  if (versionRows.length !== 3) {
    throw new Error("La comparación de políticas debe contener exactamente 3 versiones.");
  }

  const contradictionRows = findTable(lines, [
    "tema",
    "v12018",
    "leon2022",
    "v32024",
  ]);
  if (!contradictionRows) {
    throw new Error("No se encontró la tabla de contradicciones de las versiones.");
  }
  const note = parseNote(lines);
  if (!note) {
    throw new Error("No se encontró el apartado de la versión que se propone como vigente.");
  }

  const versiones = versionRows.map((row, index) => ({
    clave: VERSION_KEYS[index],
    etiqueta: VERSION_LABELS[index],
    archivo: row.archivo,
    version: row.versioninterna,
    fecha: row.fecha,
    elaboro: row.elaboro,
    aplicaA: row.aplicaa,
  }));
  const contradicciones = contradictionRows.map((row) => ({
    tema: row.tema,
    v1: row.v12018,
    leon: row.leon2022,
    v3: row.v32024,
  }));

  return {
    versiones,
    contradicciones,
    vigente: "v3",
    notaVigente: note,
  };
}
