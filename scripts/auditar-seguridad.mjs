import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.resolve(ROOT, "..", "data");
const RESULTS_START = "<!-- SECURITY_AUDIT_RESULTS_START -->";
const RESULTS_END = "<!-- SECURITY_AUDIT_RESULTS_END -->";
const ALLOWED_LOG_FIELDS = new Set([
  "usuario",
  "endpoint",
  "estado",
  "status",
  "milisegundos",
  "tamano",
  "size",
  "mensajes",
  "servicio",
  "code",
  "codigo",
]);

const secretPatterns = [
  {
    type: "asignación de clave, secreto, token o contraseña",
    expression: /(?:^|[^A-Z0-9_])[A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD)\s*[:=]\s*["']?(?:[A-F0-9]{32}|[A-Z0-9+/_-]{40,}={0,2})["']?/gi,
  },
  { type: "DefaultEndpointsProtocol", expression: /DefaultEndpointsProtocol\s*=/i },
  { type: "AccountKey", expression: /AccountKey\s*=\s*[^;\s'"]+/i },
  { type: "firma de acceso compartido", expression: /SharedAccess(?:Signature)\b/i },
  { type: "clave privada", expression: /BEGIN\s+(?:[A-Z0-9]+\s+)?PRIVATE KEY/i },
  { type: "perfil de publicación", expression: /<publish(?:Data|Profile)\b/i },
];

export function detectSecretFindings(text) {
  return secretPatterns
    .filter(({ expression }) => {
      expression.lastIndex = 0;
      return expression.test(text);
    })
    .map(({ type }) => type);
}

function relative(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}

function listFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const current = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(current) : [current];
  });
}

function isDemoUsersException(filePath) {
  const normalized = filePath.split(path.sep).join("/").toLowerCase();
  const demoPaths = [
    "data/empleados/usuarios.json",
    "api/data/usuarios.json",
    "src/features/auth/data/usuarios.json",
  ];
  return demoPaths.some((demoPath) =>
    normalized === demoPath || normalized.endsWith(`/${demoPath}`));
}

function isExampleFile(filePath) {
  const name = path.basename(filePath).toLowerCase();
  return name === "local.settings.example.json" || name === ".env.example";
}

function scanSecretFiles(filePaths, { skipDemoUsers = false } = {}) {
  const findings = [];
  const unreadable = [];
  for (const filePath of filePaths) {
    if (isExampleFile(filePath) || (skipDemoUsers && isDemoUsersException(filePath))) continue;
    try {
      const text = fs.readFileSync(filePath).toString("utf8");
      for (const type of detectSecretFindings(text)) {
        findings.push(`${relative(filePath)} (${type})`);
      }
    } catch {
      unreadable.push(filePath);
    }
  }
  return { findings, unreadable };
}

function trackedFiles() {
  try {
    const result = execFileSync("git", ["ls-files", "-z"], {
      cwd: ROOT,
      encoding: "buffer",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return {
      available: true,
      files: result.toString("utf8")
        .split("\0")
        .filter(Boolean)
        .map((file) => path.join(ROOT, file)),
    };
  } catch {
    return { available: false, files: [] };
  }
}

function checkTrackedSecrets() {
  const tracked = trackedFiles();
  if (!tracked.available) {
    return { result: "OMITIDA", detail: "git ls-files no disponible." };
  }
  const { findings, unreadable } = scanSecretFiles(tracked.files, { skipDemoUsers: true });
  const detail = [
    findings.length ? `${findings.length} hallazgo(s): ${findings.join("; ")}` : "sin hallazgos",
    unreadable.length ? `${unreadable.length} archivo(s) no legible(s): ${unreadable.map(relative).join(", ")}` : "",
  ].filter(Boolean).join("; ");
  return { result: findings.length || unreadable.length ? "FALLÓ" : "OK", detail };
}

function localSettingsVariableNames() {
  const settingsPath = path.join(ROOT, "api", "local.settings.json");
  if (!fs.existsSync(settingsPath)) return { names: [], error: false };
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    return {
      names: Object.keys(settings.Values || {}).filter((name) => name.length >= 4),
      error: false,
    };
  } catch {
    return { names: [], error: true };
  }
}

function checkPublishedBundle() {
  const directory = path.join(ROOT, "dist-azure");
  if (!fs.existsSync(directory)) {
    return { result: "OMITIDA", detail: "dist-azure no existe; no hay paquete publicado que analizar." };
  }

  const localSettings = localSettingsVariableNames();
  const findings = [];
  const unreadable = [];
  for (const filePath of listFiles(directory)) {
    let text;
    try {
      text = fs.readFileSync(filePath).toString("utf8");
    } catch {
      unreadable.push(filePath);
      continue;
    }
    for (const type of detectSecretFindings(text)) {
      findings.push(`${relative(filePath)} (${type})`);
    }
    if (text.includes("salarioMensualMXN")) findings.push(`${relative(filePath)} (dato salarial)`);
    if (text.includes("../data")) findings.push(`${relative(filePath)} (referencia a ../data)`);
    if (localSettings.names.some((name) => new RegExp(`\\b${escapeRegExp(name)}\\b`).test(text))) {
      findings.push(`${relative(filePath)} (nombre de variable de api/local.settings.json publicado)`);
    }
  }
  if (localSettings.error) unreadable.push(path.join(ROOT, "api", "local.settings.json"));
  const detail = [
    findings.length ? `${findings.length} hallazgo(s): ${findings.join("; ")}` : "sin hallazgos",
    unreadable.length ? `no se pudo analizar: ${unreadable.map(relative).join(", ")}` : "",
  ].filter(Boolean).join("; ");
  return { result: findings.length || unreadable.length ? "FALLÓ" : "OK", detail };
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function shallowRepository() {
  try {
    return execFileSync("git", ["rev-parse", "--is-shallow-repository"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim() === "true";
  } catch {
    return null;
  }
}

function checkGitHistory() {
  if (!trackedFiles().available) {
    return { result: "OMITIDA", detail: "git no disponible." };
  }
  const shallow = shallowRepository();
  if (shallow === null) {
    return { result: "OMITIDA", detail: "no se pudo determinar si el historial está completo." };
  }
  if (shallow) {
    return { result: "OMITIDA", detail: "clon superficial; no se puede certificar todo el historial." };
  }
  try {
    const history = execFileSync("git", [
      "log", "--all", "--oneline", "--",
      "api/local.settings.json", ".env", ".env.local",
    ], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return history
      ? { result: "FALLÓ", detail: "hay confirmaciones de api/local.settings.json, .env o .env.local." }
      : { result: "OK", detail: "ninguno de esos archivos aparece en el historial disponible." };
  } catch {
    return { result: "FALLÓ", detail: "git log no pudo completar la comprobación." };
  }
}

function checkIgnoreAndAzureEnvironment() {
  const ignorePath = path.join(ROOT, ".gitignore");
  const envPath = path.join(ROOT, ".env.azure");
  const errors = [];
  if (!fs.existsSync(ignorePath)) {
    errors.push("falta .gitignore");
  } else {
    const ignored = new Set(
      fs.readFileSync(ignorePath, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim().replace(/\/+$/, "").replace(/^\/+/, ""))
        .filter((line) => line && !line.startsWith("#")),
    );
    for (const entry of [
      "api/local.settings.json",
      ".env",
      ".env.local",
      "node_modules",
      "dist",
      "dist-azure",
    ]) {
      if (!ignored.has(entry)) errors.push(`no ignora ${entry}`);
    }
  }

  if (!fs.existsSync(envPath)) {
    errors.push("falta .env.azure");
  } else {
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    const names = lines
      .filter((line) => line.trim() && !line.trim().startsWith("#"))
      .map((line) => /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)?.[1] ?? "");
    const expected = ["VITE_USE_AZURE", "VITE_API_BASE_URL"];
    if (names.length !== expected.length || expected.some((name) => names.filter((item) => item === name).length !== 1)) {
      errors.push(".env.azure debe contener únicamente VITE_USE_AZURE y VITE_API_BASE_URL");
    }
    if (detectSecretFindings(fs.readFileSync(envPath, "utf8")).length) {
      errors.push(".env.azure contiene un patrón de secreto");
    }
  }

  return {
    result: errors.length ? "FALLÓ" : "OK",
    detail: errors.length ? errors.join("; ") : ".gitignore completo y .env.azure contiene solo las dos variables permitidas, sin patrones de secreto.",
  };
}

function matchingLogCalls(apiDirectory) {
  const calls = [];
  const callPattern = /\b(?:console\.log|context\.log|logger\.(?:log|info|warn|error|debug))\s*\(/g;
  const sensitivePattern = /\b(?:body|texto|content|base64|headers?|authorization|bearer|password|secret|token|prompt|payload)\b/i;
  for (const filePath of listFiles(apiDirectory).filter((file) => /\.(?:[cm]?js|ts|tsx)$/i.test(file))) {
    const source = fs.readFileSync(filePath, "utf8");
    let match;
    while ((match = callPattern.exec(source)) !== null) {
      const opening = source.indexOf("(", match.index);
      let depth = 1;
      let quote = "";
      let escaped = false;
      let closing = opening + 1;
      for (; closing < source.length && depth > 0; closing += 1) {
        const character = source[closing];
        if (quote) {
          if (escaped) escaped = false;
          else if (character === "\\") escaped = true;
          else if (character === quote) quote = "";
        } else if (character === "'" || character === '"' || character === "`") {
          quote = character;
        } else if (character === "(") {
          depth += 1;
        } else if (character === ")") {
          depth -= 1;
        }
      }
      const argument = source.slice(opening + 1, closing - 1);
      const fields = [...argument.matchAll(/(?:^|[{,])\s*([A-Za-z_$][\w$]*)\s*(?=[:,}])/g)]
        .map((entry) => entry[1]);
      const allowed = fields.length > 0 && fields.every((field) => ALLOWED_LOG_FIELDS.has(field));
      const containsSensitiveData = sensitivePattern.test(argument);
      const line = source.slice(0, match.index).split("\n").length;
      calls.push({
        location: `${relative(filePath)}:${line}`,
        allowed: allowed && !containsSensitiveData,
      });
    }
  }
  return calls;
}

function checkApiLogs() {
  const calls = matchingLogCalls(path.join(ROOT, "api", "src"));
  const unsafe = calls.filter((call) => !call.allowed);
  const detail = calls.length
    ? calls.map(({ location, allowed }) => `${location} (${allowed ? "metadatos permitidos" : "revisar: campo no permitido o contenido sensible"})`).join("; ")
    : "sin llamadas a console.log, context.log o logger";
  return { result: unsafe.length ? "FALLÓ" : "OK", detail };
}

function checkEndpointGuards() {
  const functionsDirectory = path.join(ROOT, "api", "src", "functions");
  const handlersDirectory = path.join(ROOT, "api", "src", "handlers");
  const requiredEndpoints = [
    ["extractInvoice", "extractInvoice.js", 'roles: [{ modulo: "facturas_proveedores", accion: "crear" }]'],
    ["chat", "chat.js", 'roles: [{ modulo: "asistente_ia", accion: "usar" }]'],
    ["analyzeComplaint", "analyzeComplaint.js", 'can(session.rol, "quejas", "ver")'],
    ["speechToken", "speechToken.js", 'roles: [{ modulo: "asistente_ia", accion: "usar" }]'],
  ];
  const errors = [];
  for (const [name, handlerFile, permissionExpression] of requiredEndpoints) {
    const functionPath = path.join(functionsDirectory, `${name}.js`);
    const handlerPath = path.join(handlersDirectory, handlerFile);
    if (!fs.existsSync(functionPath) || !fs.existsSync(handlerPath)) {
      errors.push(`${name}: faltan archivos de función o handler`);
      continue;
    }
    const functionSource = fs.readFileSync(functionPath, "utf8");
    const handlerSource = fs.readFileSync(handlerPath, "utf8");
    if (!functionSource.includes(`app.http("${name}"`) || !functionSource.includes("handler")) {
      errors.push(`${name}: registro de Azure Function no confirmado`);
    }
    if (!handlerSource.includes("requireSession(") || !handlerSource.includes(permissionExpression)) {
      errors.push(`${name}: sesión o permiso por rol no confirmado`);
    }
    if (name === "analyzeComplaint"
      && !handlerSource.includes('can(session.rol, "quejas", "crear")')) {
      errors.push(`${name}: permiso de creación no confirmado`);
    }
  }

  const loginPath = path.join(handlersDirectory, "login.js");
  const login = fs.existsSync(loginPath) ? fs.readFileSync(loginPath, "utf8") : "";
  if (!login.includes("MAX_ATTEMPTS") || !login.includes("rateLimiter.peek") || !login.includes("rateLimiter.check")) {
    errors.push("login: límite de intentos no confirmado");
  }

  const healthPath = path.join(handlersDirectory, "health.js");
  const health = fs.existsSync(healthPath) ? fs.readFileSync(healthPath, "utf8") : "";
  const configReads = [...health.matchAll(/\bconfig\.([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?)/g)]
    .map((match) => match[1]);
  const expectedConfigReads = [
    "docIntelligence.configurado",
    "chat.configurado",
    "language.configurado",
    "speech.configurado",
    "assistantEnabled",
  ];
  if (!health.includes("jsonBody:") || expectedConfigReads.some((item) => !configReads.includes(item))
    || configReads.some((item) => !expectedConfigReads.includes(item))
    || /\b(?:tokenSecret|subscriptionKey|apiKey|endpoint|connectionString)\b/i.test(health)) {
    errors.push("health: la respuesta no se pudo certificar como metadatos/booleanos sin configuración secreta");
  }

  return {
    result: errors.length ? "FALLÓ" : "OK",
    detail: errors.length
      ? errors.join("; ")
      : "extractInvoice, chat, analyzeComplaint y speechToken exigen sesión/rol; login limita intentos; health solo expone indicadores booleanos y metadatos.",
  };
}

function runPrivacyChecks() {
  if (!fs.existsSync(DATA_DIR)) {
    return { result: "OMITIDA", detail: "data/ no está disponible; se omiten las comprobaciones PS-* dependientes de datos." };
  }
  const checksPath = path.join(ROOT, "src", "features", "responsible-ai", "domain", "checks.js");
  const source = fs.existsSync(checksPath) ? fs.readFileSync(checksPath, "utf8") : "";
  const localIds = [...source.matchAll(/localCheck\(deps,\s*\[\s*"(PS-\d+)"/g)]
    .map((match) => match[1]);
  if (!localIds.length) {
    return { result: "FALLÓ", detail: "no se encontraron comprobaciones locales PS-* para ejecutar." };
  }
  const vitestCli = path.join(ROOT, "node_modules", "vitest", "vitest.mjs");
  if (!fs.existsSync(vitestCli)) {
    return { result: "FALLÓ", detail: "Vitest no está instalado; no se pudieron ejecutar las comprobaciones PS-*." };
  }
  const run = spawnSync(process.execPath, [
    vitestCli,
    "run",
    "tests/security.audit.test.js",
    "--reporter=dot",
  ], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: "ignore",
    env: { ...process.env, RUN_SECURITY_PRIVACY_AUDIT: "1" },
    timeout: 120_000,
  });
  return run.status === 0
    ? { result: "OK", detail: `${localIds.length}/${localIds.length} comprobaciones locales PS-* aprobadas.` }
    : { result: "FALLÓ", detail: `0/${localIds.length} comprobaciones locales PS-* aprobadas; prueba de privacidad fallida (salida omitida).` };
}

function tableMarkdown(rows, date) {
  const lines = [
    `Resultados más recientes: ${date}.`,
    "",
    "| Comprobación | Resultado | Detalle |",
    "|---|---|---|",
    ...rows.map(({ check, result, detail }) =>
      `| ${check.replace(/\|/g, "\\|")} | ${result} | ${detail.replace(/\|/g, "\\|")} |`),
  ];
  return lines.join("\n");
}

function updateDocumentation(rows, date) {
  const docsPath = path.join(ROOT, "docs", "SEGURIDAD.md");
  const docs = fs.readFileSync(docsPath, "utf8");
  const start = docs.indexOf(RESULTS_START);
  const end = docs.indexOf(RESULTS_END);
  if (start < 0 || end < start) throw new Error("No se encontraron los marcadores de resultados en docs/SEGURIDAD.md.");
  const before = docs.slice(0, start + RESULTS_START.length);
  const after = docs.slice(end);
  fs.writeFileSync(docsPath, `${before}\n${tableMarkdown(rows, date)}\n${after}`, "utf8");
}

export async function audit() {
  const checks = [
    ["Secretos en archivos versionados", checkTrackedSecrets()],
    ["Secretos y datos sensibles en dist-azure", checkPublishedBundle()],
    ["Historial Git de configuración local", checkGitHistory()],
    [".gitignore y .env.azure", checkIgnoreAndAzureEnvironment()],
    ["Registros de la API", checkApiLogs()],
    ["Autenticación, roles, límites y health", checkEndpointGuards()],
    ["Privacidad IA responsable (PS-*)", runPrivacyChecks()],
  ];
  const rows = checks.map(([check, outcome]) => ({ check, ...outcome }));
  const date = new Date().toISOString().slice(0, 10);
  updateDocumentation(rows, date);
  console.table(rows.map(({ check, result, detail }) => ({
    comprobación: check,
    resultado: result,
    detalle: detail,
  })));
  if (rows.some(({ result }) => result === "FALLÓ")) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await audit();
}
