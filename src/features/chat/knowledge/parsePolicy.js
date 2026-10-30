const SECTION_NAMES = new Set(["Propósito", "Alcance", "Reglas", "Procedimiento"]);

function parseFrontMatter(markdown) {
  const match = String(markdown).match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\s*\r?\n|$)/);
  if (!match) return { attributes: {}, body: String(markdown) };
  const attributes = {};
  for (const line of match[1].split(/\r?\n/)) {
    const attribute = line.match(/^([a-zA-Z0-9_]+):\s*(.*?)\s*$/);
    if (!attribute) continue;
    let value = attribute[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    attributes[attribute[1]] = value;
  }
  return { attributes, body: String(markdown).slice(match[0].length) };
}

function extractSections(markdown) {
  const sections = new Map();
  const lines = markdown.split(/\r?\n/);
  let currentSection = null;
  for (const line of lines) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      currentSection = SECTION_NAMES.has(heading[1].trim()) ? heading[1].trim() : null;
      if (currentSection && !sections.has(currentSection)) sections.set(currentSection, []);
      continue;
    }
    if (currentSection) sections.get(currentSection).push(line);
  }
  return new Map([...sections].map(([title, content]) => [title, content.join("\n").trim()]));
}

function cleanText(value) {
  return String(value ?? "").trim();
}

/**
 * Analiza una política Markdown con front matter y las secciones vigentes.
 * @param {string} markdown Contenido Markdown de la política.
 * @returns {Object} Política normalizada para búsqueda.
 */
export function parsePolicy(markdown) {
  const { attributes, body } = parseFrontMatter(markdown);
  for (const required of ["id", "titulo", "version"]) {
    if (!attributes[required]) {
      throw new Error(`La política no contiene el campo obligatorio "${required}".`);
    }
  }

  const sections = extractSections(body);
  const reglas = (sections.get("Reglas") || "")
    .split(/\r?\n/)
    .flatMap((line) => {
      const rule = line.match(/^\s*-\s+\*\*(.+?):\*\*\s*(.*)$/);
      return rule ? [{ tema: cleanText(rule[1]), texto: cleanText(rule[2]) }] : [];
    });
  const procedimiento = (sections.get("Procedimiento") || "")
    .split(/\r?\n/)
    .flatMap((line) => {
      const step = line.match(/^\s*\d+[.)]\s+(.+?)\s*$/);
      return step ? [cleanText(step[1])] : [];
    });

  return {
    id: attributes.id,
    titulo: attributes.titulo,
    version: attributes.version,
    vigente: String(attributes.vigente).toLocaleLowerCase("es-MX") === "true",
    vigenteDesde: attributes.vigente_desde || attributes.vigenteDesde || "",
    audiencia: attributes.audiencia || "",
    responsable: attributes.responsable || "",
    proposito: cleanText(sections.get("Propósito")),
    alcance: cleanText(sections.get("Alcance")),
    reglas,
    procedimiento,
  };
}

/**
 * Divide una política en fragmentos con metadatos de cita.
 * @param {Object} politica Política analizada.
 * @returns {Object[]} Fragmentos recuperables.
 */
export function policyToFragments(politica) {
  const fragments = [];
  if (politica.proposito) {
    fragments.push({
      id: `${politica.id}#P`,
      polId: politica.id,
      titulo: politica.titulo,
      version: politica.version,
      audiencia: politica.audiencia,
      seccion: "Propósito",
      tema: "Propósito",
      texto: politica.proposito,
    });
  }
  if (politica.alcance) {
    fragments.push({
      id: `${politica.id}#A`,
      polId: politica.id,
      titulo: politica.titulo,
      version: politica.version,
      audiencia: politica.audiencia,
      seccion: "Alcance",
      tema: "Alcance",
      texto: politica.alcance,
    });
  }
  for (const [index, rule] of politica.reglas.entries()) {
    fragments.push({
      id: `${politica.id}#R${index + 1}`,
      polId: politica.id,
      titulo: politica.titulo,
      version: politica.version,
      audiencia: politica.audiencia,
      seccion: "Reglas",
      tema: rule.tema,
      texto: rule.texto,
    });
  }
  if (politica.procedimiento.length) {
    fragments.push({
      id: `${politica.id}#PR`,
      polId: politica.id,
      titulo: politica.titulo,
      version: politica.version,
      audiencia: politica.audiencia,
      seccion: "Procedimiento",
      tema: "Procedimiento",
      texto: politica.procedimiento.map((step, index) => `${index + 1}. ${step}`).join("\n"),
    });
  }
  return fragments;
}
