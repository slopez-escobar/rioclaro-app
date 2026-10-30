const STOP_WORDS = new Set(["de", "para", "el", "la"]);

function stripAccents(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX");
}

function canonicalVolume(text) {
  return text.replace(/\b(\d+(?:\.\d+)?)\s*(ml|mililitros?)\b/g, (match, amountText) => {
    const amount = Number(amountText);
    if (amount > 0 && amount % 1000 === 0) {
      const liters = amount / 1000;
      return `${liters} ${liters === 1 ? "litro" : "litros"}`;
    }
    return `${amount} mililitros`;
  }).replace(/\b(\d+(?:\.\d+)?)\s*(?:l|lt|lts|litro|litros)\b/g, (match, amountText) => {
    const amount = Number(amountText);
    return `${amount} ${amount === 1 ? "litro" : "litros"}`;
  });
}

/**
 * Normaliza nombres y presentaciones para comparar productos de distintas sucursales.
 * @param {string} text Nombre o presentación publicada.
 * @returns {string} Texto canónico sin acentos ni puntuación.
 */
export function normalizeName(text) {
  let value = stripAccents(text)
    .replace(/\bp\s*\/\s*/g, " para ")
    .replace(/\bc\s*\/\s*/g, " con ")
    .replace(/,/g, "")
    .replace(/\b(?:lts|lt)\b/g, "litros")
    .replace(/\b(?:pzas|pzs|pz|pza)\b/g, "piezas")
    .replace(/\b(?:paq|pq|pqt)\b/g, "paquete")
    .replace(/\bcja\b/g, "caja")
    .replace(/\brll\b/g, "rollos")
    .replace(/\bmult\b/g, "multiusos");

  value = value
    .replace(/\bpapel\s+(?:sanitario|de\s+bano)\b/g, "papel higienico")
    .replace(/\btoalla\s+z\b/g, "toalla interdoblada")
    .replace(/\bantibacteriano\b/g, "antibacterial")
    .replace(/\bcubo\b/g, "cubeta")
    .replace(/\bjabon\s+en\s+polvo\b/g, "detergente en polvo")
    .replace(/\bdetergente\s+polvo\b/g, "detergente en polvo")
    .replace(/\bpastillas\s+sanitarias\b/g, "pastillas sanitarias para bano")
    .replace(/\bpastillas\s+para\s+bano\b/g, "pastillas sanitarias para bano")
    .replace(/\besponja\s+fibra\b/g, "fibra para trastes")
    .replace(/\bfibra\s+verde\b/g, "fibra para trastes")
    .replace(/\bgel\s+sanitizante\b/g, "gel antibacterial")
    .replace(/\bcubreboca\b/g, "cubrebocas")
    .replace(/\bescoba\s+normal\b/g, "escoba estandar")
    .replace(/\bdesinfectante\s+uso\s+general\b/g, "desinfectante multiusos")
    .replace(/\bjabon\s+manos\b/g, "jabon liquido para manos")
    .replace(/\bsuavizante\s+ropa\b/g, "suavizante de telas")
    .replace(/\blimpiador\s+multiusos\b/g, "desinfectante multiusos")
    .replace(/\baromatizante\s+spray\b/g, "aromatizante ambiental aerosol")
    .replace(/\bblanqueador\b/g, "cloro")
    .replace(/\bmechudo\b/g, "trapeador")
    .replace(/\bgalon\b/g, "4 litros")
    .replace(/\blitro\b/g, (unit, offset, original) => {
      const hasQuantity = /\d+(?:\.\d+)?\s*$/.test(original.slice(0, offset));
      return hasQuantity ? unit : "1 litro";
    })
    .replace(/\blitros?\b/g, "litros");
  value = value
    .replace(/\bpaquete\s+(?:de\s+)?(\d+)\b/g, "$1 piezas")
    .replace(/\bpaquetes?\b/g, "paquetes")
    .replace(/\bcajas?\b/g, "cajas")
    .replace(/\brollos?\b/g, "rollos")
    .replace(/\bservilleta\b/g, "servilletas");
  value = canonicalVolume(value);
  value = value.replace(/\blitros\b/g, (match, offset, original) => {
    const previous = original.slice(0, offset).match(/(\d+(?:\.\d+)?)\s*$/);
    return previous && Number(previous[1]) === 1 ? "litro" : "litros";
  });

  return value
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Extrae una medida cuantificada y la expresa en unidades canónicas.
 * @param {string} text Nombre o presentación.
 * @returns {{cantidad:number, unidad:string}|null} Medida encontrada.
 */
export function extractSize(text) {
  const normalized = normalizeName(text);
  const match = normalized.match(/\b(\d+(?:\.\d+)?)\s*(litro|litros|mililitros|kilogramos|gramos|piezas|rollos|cajas|paquetes)\b/);
  if (!match) return null;
  const amount = Number(match[1]);
  const pluralUnit = match[2] === "litro" ? "litros" : match[2];
  const unit = amount === 1
    ? ({
      litros: "litro",
      mililitros: "mililitro",
      kilogramos: "kilogramo",
      gramos: "gramo",
      piezas: "pieza",
      rollos: "rollo",
      cajas: "caja",
      paquetes: "paquete",
    }[pluralUnit] || pluralUnit)
    : pluralUnit;
  return { cantidad: amount, unidad: unit };
}

/**
 * Convierte un precio numérico o textual a dos decimales.
 * @param {number|string} value Precio publicado.
 * @returns {number|null} Precio normalizado o null si no es válido.
 */
export function parsePrice(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? Number(value.toFixed(2)) : null;
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const clean = value
    .replace(/\s/g, "")
    .replace(/[$€£]/g, "")
    .replace(/,/g, "");
  if (!/^\d+(?:\.\d{1,})?$/.test(clean)) return null;
  const price = Number(clean);
  return Number.isFinite(price) ? Number(price.toFixed(2)) : null;
}

function productVariants(product) {
  const variants = [
    `${product.nombre || ""} ${product.presentacion || ""}`,
    product.nombre || "",
    ...(product.alias || []).map((alias) => `${alias} ${product.presentacion || ""}`),
    ...(product.alias || []),
  ];
  return [...new Set(variants.map(normalizeName).filter(Boolean))];
}

function rowName(row) {
  const name = row?.nombrePublicado
    ?? row?.nombre
    ?? row?.producto
    ?? row?.descripcion
    ?? "";
  const presentation = row?.presentacion ?? row?.medida ?? "";
  return extractSize(presentation) || /\bgalon\b/i.test(String(presentation))
    ? `${name} ${presentation}`.trim()
    : String(name).trim();
}

function tokens(value) {
  return normalizeName(value)
    .split(" ")
    .filter((token) => token && !STOP_WORDS.has(token));
}

function jaccard(left, right) {
  const leftTokens = new Set(tokens(left));
  const rightTokens = new Set(tokens(right));
  if (!leftTokens.size || !rightTokens.size) return 0;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return intersection / new Set([...leftTokens, ...rightTokens]).size;
}

function sizesConflict(left, right) {
  const leftSize = extractSize(left);
  const rightSize = extractSize(right);
  return Boolean(leftSize && rightSize
    && (leftSize.cantidad !== rightSize.cantidad || leftSize.unidad !== rightSize.unidad));
}

/**
 * Compara una fila publicada con el catálogo y deja coincidencias dudosas en revisión.
 * @param {Object} row Fila del Excel de una sucursal.
 * @param {Object[]} catalogo Catálogo de productos canónico.
 * @returns {Object} Resultado de coincidencia con candidatos.
 */
export function matchProduct(row, catalogo) {
  const name = rowName(row);
  const normalizedName = normalizeName(name);
  if (!normalizedName) {
    return { clave: null, estado: "Revisar", mejorCandidato: null, puntaje: 0 };
  }

  const exactMatches = catalogo
    .filter((product) => productVariants(product).includes(normalizedName))
    .filter((product) => !sizesConflict(name, `${product.nombre} ${product.presentacion || ""}`));
  if (exactMatches.length === 1) {
    const product = exactMatches[0];
    return {
      clave: product.claveProducto,
      puntaje: 1,
      metodo: (product.alias || []).some((alias) => normalizeName(`${alias} ${product.presentacion || ""}`) === normalizedName
        || normalizeName(alias) === normalizedName) ? "alias" : "nombre",
      candidatos: [{ clave: product.claveProducto, nombre: product.nombre, puntaje: 1 }],
    };
  }

  const candidates = catalogo
    .filter((product) => !productVariants(product).every((variant) => sizesConflict(name, variant)))
    .map((product) => {
      const variants = productVariants(product)
        .filter((variant) => !sizesConflict(name, variant));
      const score = variants.reduce((best, variant) => Math.max(best, jaccard(name, variant)), 0);
      return { clave: product.claveProducto, nombre: product.nombre, puntaje: score };
    })
    .sort((left, right) => right.puntaje - left.puntaje || left.clave.localeCompare(right.clave));
  const [best, second] = candidates;
  const accepted = best && best.puntaje >= 0.85
    && (!second || best.puntaje - second.puntaje >= 0.1);
  if (accepted) {
    return {
      clave: best.clave,
      puntaje: best.puntaje,
      metodo: "similitud",
      candidatos: candidates.slice(0, 3),
    };
  }
  return {
    clave: null,
    estado: "Revisar",
    mejorCandidato: best || null,
    puntaje: best?.puntaje || 0,
    candidatos: candidates.slice(0, 3),
  };
}

/**
 * Infiere la conversión de precio e inventario a partir de filas ya resueltas.
 * @param {Object[]} filasResueltas Filas con clave, precioPublicado y existenciaPublicada.
 * @param {Object[]} catalogo Catálogo de productos.
 * @param {Object[]} existencias Existencia física y disponible por sucursal.
 * @returns {{factorPrecio:number,precioIncluyeIVA:boolean,existenciaSignifica:string}} Convenciones de publicación.
 */
export function inferBranchConventions(filasResueltas, catalogo, existencias) {
  const byKey = new Map(catalogo.map((product) => [product.claveProducto, product]));
  const ratios = filasResueltas.flatMap((row) => {
    const price = parsePrice(row.precioPublicado);
    const listPrice = byKey.get(row.clave)?.precioListaMXN;
    return price > 0 && listPrice > 0 ? [price / listPrice] : [];
  }).sort((left, right) => left - right);
  const middle = Math.floor(ratios.length / 2);
  const factorPrecio = ratios.length
    ? Number((ratios.length % 2 ? ratios[middle] : (ratios[middle - 1] + ratios[middle]) / 2).toFixed(3))
    : 1;
  const precioIncluyeIVA = Math.abs(factorPrecio - 1.16) <= 0.005;

  const byInventoryKey = new Map(existencias.map((item) => [
    `${item.idSucursal}:${item.claveProducto}`,
    item,
  ]));
  let physicalMatches = 0;
  let availableMatches = 0;
  let comparableRows = 0;
  for (const row of filasResueltas) {
    const published = Number(row.existenciaPublicada);
    const inventory = byInventoryKey.get(`${row.sucursal}:${row.clave}`);
    if (!Number.isFinite(published) || !inventory) continue;
    comparableRows += 1;
    if (published === inventory.existencia) physicalMatches += 1;
    if (published === inventory.disponible) availableMatches += 1;
  }
  const physicalShare = comparableRows ? physicalMatches / comparableRows : 0;
  const availableShare = comparableRows ? availableMatches / comparableRows : 0;
  const existenciaSignifica = physicalShare > 0.8 && physicalMatches > availableMatches
    ? "fisica"
    : availableShare > 0.8 && availableMatches > physicalMatches
      ? "disponible"
      : "indeterminado";

  return { factorPrecio, precioIncluyeIVA, existenciaSignifica };
}
