const SPANISH_MONTHS = {
  ene: 1, enero: 1,
  feb: 2, febrero: 2,
  mar: 3, marzo: 3,
  abr: 4, abril: 4,
  may: 5, mayo: 5,
  jun: 6, junio: 6,
  jul: 7, julio: 7,
  ago: 8, agosto: 8,
  sep: 9, sept: 9, septiembre: 9, setiembre: 9,
  oct: 10, octubre: 10,
  nov: 11, noviembre: 11,
  dic: 12, diciembre: 12,
};

/**
 * Convierte un RFC a mayúsculas y elimina espacios, guiones y puntos.
 * @param {*} valor RFC de entrada.
 * @returns {string} RFC normalizado o cadena vacía.
 */
export function normalizeRfc(valor) {
  return valor === null || valor === undefined
    ? ""
    : String(valor).toUpperCase().replace(/[\s.-]/g, "");
}

/**
 * Convierte un folio a mayúsculas y elimina separadores no significativos.
 * @param {*} valor Folio de entrada.
 * @returns {string} Folio normalizado o cadena vacía.
 */
export function normalizeFolio(valor) {
  return valor === null || valor === undefined
    ? ""
    : String(valor).toUpperCase().replace(/[\s./-]/g, "");
}

/**
 * Normaliza texto y elimina sufijos societarios mexicanos comunes.
 * @param {*} valor Texto de entrada.
 * @returns {string} Texto en minúsculas, sin acentos ni puntuación.
 */
export function normalizeText(valor) {
  if (valor === null || valor === undefined) return "";
  const texto = String(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
  return texto
    .replace(/\s+(?:s a de c v|s de r l de c v|s a p i de c v)$/, "")
    .trim();
}

/**
 * Convierte un importe numérico o textual a dos decimales.
 * @param {*} valor Importe de entrada.
 * @returns {number|null} Importe normalizado o null si no es válido.
 */
export function normalizeAmount(valor) {
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? Number(valor.toFixed(2)) : null;
  }
  if (typeof valor !== "string") return null;

  const texto = valor.trim().replace(/^\$\s*/, "");
  if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(texto)) return null;
  const amount = Number(texto.replace(/,/g, ""));
  return Number.isFinite(amount) ? Number(amount.toFixed(2)) : null;
}

/**
 * Valida una fecha aceptada por el dominio y la devuelve en formato ISO.
 * @param {*} valor Fecha en formato ISO o español de día/mes/año.
 * @returns {string|null} Fecha AAAA-MM-DD o null si no es válida.
 */
export function normalizeDate(valor) {
  if (typeof valor !== "string") return null;
  const texto = valor.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let year;
  let month;
  let day;
  let match;

  if ((match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(texto))) {
    [, year, month, day] = match;
    year = Number(year);
    month = Number(month);
    day = Number(day);
  } else if ((match = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(texto))) {
    [, day, month, year] = match;
    year = Number(year);
    month = Number(month);
    day = Number(day);
  } else if ((match = /^(\d{1,2})-([a-z]+)-(\d{4})$/.exec(texto))) {
    [, day, month] = match;
    year = Number(match[3]);
    month = SPANISH_MONTHS[month];
    day = Number(day);
  } else if ((match = /^(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})$/.exec(texto))) {
    [, day, month] = match;
    year = Number(match[3]);
    month = SPANISH_MONTHS[month];
    day = Number(day);
  } else {
    return null;
  }

  if (!Number.isInteger(year) || year < 1 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (!Number.isInteger(day) || day < 1 || day > daysInMonth) return null;

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
