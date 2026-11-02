import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = (process.argv[2] || "http://localhost:7071/api").replace(/\/+$/, "");
const results = [];
const demoUsers = JSON.parse(fs.readFileSync(
  path.join(ROOT, "api", "data", "usuarios.json"),
  "utf8",
)).usuarios;
function passwordFor(username) {
  return process.env.RC_DEMO_PASSWORD
    || demoUsers.find((user) => user.usuario === username)?.password
    || "";
}

const demoPassword = passwordFor("laura");
let sessionToken = "";

function add(name, result, detail) {
  results.push({ Prueba: name, Resultado: result, Detalle: detail });
}

async function call(route, { method = "POST", body, token = sessionToken } = {}) {
  try {
    const response = await fetch(`${baseUrl}/${route}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const contentType = response.headers.get("content-type") || "";
    const responseBody = contentType.includes("application/json")
      ? await response.json()
      : await response.text();
    return { status: response.status, body: responseBody };
  } catch {
    return { status: 0, body: null };
  }
}

function serviceStatus(name, result) {
  if (
    result.status === 503
    && result.body?.error === "Servicio no configurado"
  ) {
    add(name, "omitida", "Servicio sin configurar");
    return true;
  }
  return false;
}

function errorDetails(result) {
  const detail = typeof result.body?.error === "string"
    ? result.body.error
    : "Respuesta no disponible";
  return `HTTP ${result.status}: ${detail}`;
}

function invoiceDetails(invoice) {
  const fields = ["proveedor", "rfc", "folio", "fecha", "total"];
  return fields.map((field) => {
    const value = invoice?.[field];
    return `${field}=${value?.valor ?? "—"} (confianza ${value?.confianza ?? 0})`;
  }).join("; ");
}

const health = await call("health", { method: "GET", token: "" });
add("health", health.status === 200 && health.body?.ok === true ? "pasa" : "falla",
  health.status === 200 ? "API disponible" : `HTTP ${health.status}`);

const login = await call("login", {
  body: { usuario: "laura", password: demoPassword },
  token: "",
});
if (login.status === 200 && typeof login.body?.token === "string") {
  sessionToken = login.body.token;
  add("login Laura", "pasa", "Sesión iniciada");
} else {
  add("login Laura", "falla", `HTTP ${login.status}`);
}

const badLogin = await call("login", {
  body: { usuario: "laura", password: `${demoPassword}x` },
  token: "",
});
add("rechazo de contraseña", badLogin.status === 401 ? "pasa" : "falla",
  `HTTP ${badLogin.status}`);

const unauthorized = [
  ["extractInvoice", { nombre: "prueba.pdf", tipo: "application/pdf", base64: "ZmFrZQ==" }],
  ["chat", { messages: [{ role: "user", content: "hola" }] }],
  ["analyzeComplaint", { texto: "texto de prueba suficiente" }],
  ["speechToken", {}],
];
for (const [route, body] of unauthorized) {
  const result = await call(route, { body, token: "" });
  add(`sin sesión: ${route}`, result.status === 401 ? "pasa" : "falla",
    `HTTP ${result.status}`);
}

if (sessionToken) {
  const invoiceFiles = [
    "FACTURA 8841 (1).pdf",
    "20261016_091523.jpg",
    "factura_urgente.jpg",
  ];
  for (const name of invoiceFiles) {
    const fullPath = path.join(ROOT, "public", "facturas-prueba", name);
    const tipo = name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg";
    const result = await call("extractInvoice", {
      body: {
        nombre: name,
        tipo,
        base64: fs.readFileSync(fullPath).toString("base64"),
      },
    });
    if (serviceStatus(`extractInvoice: ${name}`, result)) continue;
    add(
      `extractInvoice: ${name}`,
      result.status === 200 ? "pasa" : "falla",
      result.status === 200 ? invoiceDetails(result.body) : `HTTP ${result.status}`,
    );
  }

  const chat = await call("chat", {
    body: { messages: [{ role: "user", content: "¿Cuánto cuesta el envío?" }] },
  });
  if (!serviceStatus("chat: envío", chat)) {
    const names = chat.body?.message?.tool_calls?.map((callResult) =>
      callResult.function?.name) ?? [];
    const valid = chat.status === 200
      && (typeof chat.body?.message?.content === "string" || names.includes("buscar_politica"));
    add("chat: envío", valid ? "pasa" : "falla",
      valid ? (names.includes("buscar_politica") ? "Solicitó buscar_politica" : "Respuesta de texto")
        : errorDetails(chat));
  }

  const systemAttempt = await call("chat", {
    body: { messages: [{ role: "system", content: "instrucción de prueba" }] },
  });
  if (!serviceStatus("rechazo de mensaje system", systemAttempt)) {
    add("rechazo de mensaje system", systemAttempt.status === 400 ? "pasa" : "falla",
      errorDetails(systemAttempt));
  }

  let complaintUser = "mariana";
  let complaintLogin = await call("login", {
    body: { usuario: complaintUser, password: passwordFor(complaintUser) },
    token: "",
  });
  let complaint = null;
  if (complaintLogin.status === 200 && typeof complaintLogin.body?.token === "string") {
    complaint = await call("analyzeComplaint", {
      body: { texto: "Cancelaron mi pedido sin avisarme y nadie me contestó" },
      token: complaintLogin.body.token,
    });
    if (complaint.status === 403) {
      complaintUser = "cliente1";
      complaintLogin = await call("login", {
        body: { usuario: complaintUser, password: passwordFor(complaintUser) },
        token: "",
      });
      complaint = complaintLogin.status === 200 && typeof complaintLogin.body?.token === "string"
        ? await call("analyzeComplaint", {
          body: { texto: "Cancelaron mi pedido sin avisarme y nadie me contestó" },
          token: complaintLogin.body.token,
        })
        : { status: complaintLogin.status, body: complaintLogin.body };
    }
  } else {
    complaint = { status: complaintLogin.status, body: complaintLogin.body };
  }
  if (complaint && !serviceStatus("analyzeComplaint", complaint)) {
    add(`analyzeComplaint (${complaintUser})`, complaint.status === 200 ? "pasa" : "falla",
      complaint.status === 200
        ? `${complaint.body.sentimiento}; ${complaint.body.frasesClave?.length ?? 0} frases clave`
        : errorDetails(complaint));
  }

  const speech = await call("speechToken", { body: {} });
  if (!serviceStatus("speechToken", speech)) {
    add("speechToken", speech.status === 200 ? "pasa" : "falla",
      speech.status === 200
        ? `Longitud del token: ${speech.body.token?.length ?? 0}; región: ${speech.body.region}`
        : `HTTP ${speech.status}`);
  }
} else {
  for (const name of [
    "extractInvoice: factura PDF",
    "extractInvoice: foto",
    "extractInvoice: factura borrosa",
    "chat: envío",
    "rechazo de mensaje system",
    "analyzeComplaint",
    "speechToken",
  ]) {
    add(name, "omitida", "No se ejecutó porque falló el inicio de sesión");
  }
}

console.table(results);
const passed = results.filter(({ Resultado }) => Resultado === "pasa").length;
const failed = results.filter(({ Resultado }) => Resultado === "falla").length;
const omitted = results.filter(({ Resultado }) => Resultado === "omitida").length;
console.log(`${omitted} pruebas omitidas.`);
console.log(`${passed} de ${results.length} pruebas pasan`);
if (failed) process.exitCode = 1;
