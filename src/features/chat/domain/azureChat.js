import { can } from "../../auth/permissions.js";
import {
  NO_INFO,
  REFUSAL_INJECTION,
  REFUSAL_SENSITIVE,
} from "./guidelines.js";
import { isComplaintRequest } from "./guardrails.js";

const MAX_TOOL_RESULT_LENGTH = 4000;
const MAX_POLICY_TEXT_LENGTH = 600;
const MAX_TOOL_RESULT_LISTS = ["sucursales", "pedidos", "fragmentos"];

const SERVER_TO_APP_TOOL = {
  consultar_existencias: {
    herramienta: "consultarExistencias",
    required: ["producto"],
    optional: ["sucursal"],
  },
  consultar_precio: {
    herramienta: "consultarPrecio",
    required: ["producto"],
    optional: ["idCliente"],
  },
  estado_pedido: {
    herramienta: "estadoPedido",
    required: ["referencia"],
    optional: [],
  },
  buscar_politica: {
    herramienta: "buscarPolitica",
    required: ["consulta"],
    optional: [],
  },
  registrar_queja: {
    herramienta: "registrarQueja",
    required: ["descripcion"],
    optional: ["idPedido", "idCliente"],
  },
};

const ERROR_MESSAGES = {
  ambiguo: "Hay varias opciones posibles; se necesita precisar la consulta.",
  fuera_de_alcance: "La sucursal solicitada está fuera de tu alcance.",
  no_encontrado: "No se encontró información dentro de tu alcance.",
  no_producto: "No se encontró el producto solicitado.",
  sin_informacion: "No se encontró información disponible.",
  sin_permiso: "Tu rol no tiene permiso para realizar esta consulta.",
  sin_producto: "No se encontró el producto solicitado.",
  sin_sucursal: "No se encontró la sucursal solicitada.",
};
const GENERIC_TOOL_ERROR = "No se pudo consultar esa información.";
const UNAVAILABLE_TOOL_ERROR = "Herramienta no disponible";
const SAFE_ERROR_MESSAGES = new Set([
  GENERIC_TOOL_ERROR,
  UNAVAILABLE_TOOL_ERROR,
  "La descripción debe tener al menos 15 caracteres",
]);
const EMPTY_TOOL_RESULT = { ok: false, tipo: "resultado_demasiado_grande" };

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function safeString(value, maxLength = 200) {
  return typeof value === "string" ? value.slice(0, maxLength) : undefined;
}

function safeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toolError(result, fallback = GENERIC_TOOL_ERROR) {
  const tipo = safeString(result?.tipo, 80) || "error";
  return {
    ok: false,
    tipo,
    mensaje: SAFE_ERROR_MESSAGES.has(result?.mensaje)
      ? result.mensaje
      : ERROR_MESSAGES[tipo] || fallback,
  };
}

function stockResult(result, session) {
  const stockRows = Array.isArray(result.resultados)
    ? result.resultados
    : result.sucursal
      ? [result]
      : [];
  const sucursales = stockRows.map((stock) => {
    const row = { sucursal: safeString(stock.sucursal, 100) || "" };
    if (session?.rol === "cliente") {
      const availability = safeString(
        stock.disponibilidad ?? stock.estatus ?? stock.estatusStock,
        80,
      );
      if (availability) row.disponibilidad = availability;
      return row;
    }
    if (typeof stock.disponibilidad === "string") {
      row.disponibilidad = safeString(stock.disponibilidad, 80);
      return row;
    }
    for (const field of ["disponible", "existencia", "comprometido"]) {
      const value = safeNumber(stock[field]);
      if (value !== undefined) row[field] = value;
    }
    const status = safeString(stock.estatus ?? stock.estatusStock, 80);
    if (status) row.estatus = status;
    return row;
  });
  const product = {};
  const key = safeString(result.claveProducto, 100);
  const name = safeString(result.producto, 200);
  if (key) product.clave = key;
  if (name) product.nombre = name;
  return {
    ok: true,
    tipo: safeString(result.tipo, 80) || "existencias",
    ...(Object.keys(product).length ? { producto: product } : {}),
    sucursales,
    ...(safeString(result.corte, 80) ? { corte: result.corte } : {}),
  };
}

function priceResult(result) {
  const compact = { ok: true };
  for (const field of ["precioLista", "precioConIVA"]) {
    const value = safeNumber(result[field]);
    if (value !== undefined) compact[field] = value;
  }
  const iva = safeNumber(result.iva ?? result.ivaLista);
  if (iva !== undefined) compact.iva = iva;
  const fields = [
    "descuentoPct",
    "precioConDescuento",
    "ivaConDescuento",
    "totalConDescuento",
  ];
  for (const field of fields) {
    const value = safeNumber(result[field]);
    if (value !== undefined) compact[field] = value;
  }
  const nota = safeString(result.aclaracion, 160);
  if (nota) compact.nota = nota;
  return compact;
}

function safeOrder(order) {
  const compact = {};
  for (const [source, target] of [
    ["folio", "folio"],
    ["estado", "estado"],
    ["descripcionEstado", "descripcionEstado"],
    ["tipoEntrega", "tipoEntrega"],
    ["fechaEntregaEstimada", "fechaEntregaEstimada"],
    ["fechaEntrega", "fechaEntregaReal"],
    ["subtotal", "subtotal"],
    ["IVA", "iva"],
    ["total", "total"],
    ["sucursalSurtido", "sucursalSurtido"],
  ]) {
    const value = order[source];
    if (typeof value === "number" && Number.isFinite(value)) compact[target] = value;
    else if (typeof value === "string") compact[target] = value.slice(0, 160);
  }
  if (typeof order.surtidoEnOtraSucursal === "boolean") {
    compact.surtidoEnOtraSucursal = order.surtidoEnOtraSucursal;
  }
  if (isRecord(order.ultimoEvento)) {
    const event = {};
    for (const field of ["estado", "fecha", "fechaHora"]) {
      const value = safeString(order.ultimoEvento[field], 100);
      if (value) event[field === "fechaHora" ? "fecha" : field] = value;
    }
    if (Object.keys(event).length) compact.ultimoEvento = event;
  }
  return compact;
}

function orderResult(result) {
  const orders = Array.isArray(result.pedidos)
    ? result.pedidos
    : [result];
  return { ok: true, pedidos: orders.map(safeOrder) };
}

function policyResult(result) {
  const fragments = (Array.isArray(result.resultados) ? result.resultados : [])
    .slice(0, 3)
    .map(({ fragmento, fuente }) => ({
      id: safeString(fragmento?.id ?? fuente?.id, 100) || "",
      titulo: safeString(fragmento?.titulo ?? fuente?.titulo, 160) || "",
      version: safeString(fragmento?.version ?? fuente?.version, 40) || "",
      tema: safeString(fragmento?.tema, 120) || "",
      texto: safeString(fragmento?.texto, MAX_POLICY_TEXT_LENGTH) || "",
    }));
  return { ok: fragments.length > 0, fragmentos: fragments };
}

function complaintResult(result) {
  return {
    ok: true,
    ...(safeString(result.folio, 80) ? { folio: result.folio } : {}),
    ...(safeString(result.prioridad, 40) ? { prioridad: result.prioridad } : {}),
  };
}

function serializeWithinLimit(result) {
  let content = JSON.stringify(result);
  if (content.length <= MAX_TOOL_RESULT_LENGTH) return content;

  result.truncado = true;
  while (content.length > MAX_TOOL_RESULT_LENGTH) {
    const list = MAX_TOOL_RESULT_LISTS
      .filter((key) => Array.isArray(result[key]) && result[key].length > 0)
      .sort((left, right) =>
        JSON.stringify(result[right]).length - JSON.stringify(result[left]).length,
      )[0];
    if (!list) return JSON.stringify(EMPTY_TOOL_RESULT);
    result[list].pop();
    content = JSON.stringify(result);
  }
  return content;
}

/**
 * Reduce una respuesta de herramienta a los campos autorizados para el modelo.
 * @param {string} nombreHerramienta Nombre del servidor.
 * @param {Object} resultado Resultado de la herramienta local.
 * @returns {string} JSON compacto con límite de 4000 caracteres.
 */
export function compactToolResult(nombreHerramienta, resultado, session) {
  if (!SERVER_TO_APP_TOOL[nombreHerramienta] || !isRecord(resultado)) {
    return JSON.stringify({ ok: false, tipo: "error", mensaje: UNAVAILABLE_TOOL_ERROR });
  }
  if (resultado.ok === false) {
    const errorResult = {
      ...resultado,
      tipo: resultado.tipo
        || (nombreHerramienta === "buscar_politica" ? "sin_informacion" : "error"),
    };
    return JSON.stringify(toolError(errorResult, GENERIC_TOOL_ERROR));
  }
  let compact;
  switch (nombreHerramienta) {
    case "consultar_existencias":
      compact = stockResult(resultado, session);
      break;
    case "consultar_precio":
      compact = priceResult(resultado);
      break;
    case "estado_pedido":
      compact = orderResult(resultado);
      break;
    case "buscar_politica":
      compact = policyResult(resultado);
      if (!compact.ok) return JSON.stringify(toolError({ tipo: "sin_informacion" }));
      break;
    case "registrar_queja":
      compact = complaintResult(resultado);
      break;
    default:
      return JSON.stringify({ ok: false, tipo: "error", mensaje: UNAVAILABLE_TOOL_ERROR });
  }
  return serializeWithinLimit(compact);
}

/**
 * Valida los argumentos JSON y traduce el nombre de la herramienta a la app.
 * @param {string} nombreServidor Nombre de la herramienta del servidor.
 * @param {string} argumentos Argumentos JSON producidos por el modelo.
 * @returns {{herramienta:string,args:Object}|{error:string}} Herramienta local validada.
 */
export function toolCallToApp(nombreServidor, argumentos) {
  const definition = SERVER_TO_APP_TOOL[nombreServidor];
  if (!definition || typeof argumentos !== "string") {
    return { error: UNAVAILABLE_TOOL_ERROR };
  }
  let parsed;
  try {
    parsed = JSON.parse(argumentos);
  } catch {
    return { error: UNAVAILABLE_TOOL_ERROR };
  }
  if (!isRecord(parsed)) return { error: UNAVAILABLE_TOOL_ERROR };
  const expectedKeys = new Set([...definition.required, ...definition.optional]);
  if (Object.keys(parsed).some((key) => !expectedKeys.has(key))) {
    return { error: UNAVAILABLE_TOOL_ERROR };
  }
  if (definition.required.some((key) =>
    typeof parsed[key] !== "string" || !parsed[key].trim(),
  )) {
    return { error: UNAVAILABLE_TOOL_ERROR };
  }
  if (Object.entries(parsed).some(([key, value]) =>
    typeof value !== "string" || value.length > (key === "descripcion" ? 500 : 200),
  )) {
    return { error: UNAVAILABLE_TOOL_ERROR };
  }
  return {
    herramienta: definition.herramienta,
    args: parsed,
  };
}

/**
 * Reúne fuentes sin duplicados por tipo e identificador.
 * @param {Object[]} resultados Resultados directos o envoltorios de llamadas.
 * @returns {Object[]} Fuentes únicas encontradas.
 */
export function collectSources(resultados = []) {
  const sources = [];
  const seen = new Set();
  for (const item of resultados) {
    const result = item?.resultado || item;
    for (const source of Array.isArray(result?.fuentes) ? result.fuentes : []) {
      if (!source?.tipo || source.id === undefined || source.id === null) continue;
      const key = `${source.tipo}:${source.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      sources.push(source);
    }
  }
  return sources;
}

/**
 * Infiere acciones de atención a partir del estado y las herramientas usadas.
 * @param {Object} input Texto, resultados, estado y sesión del usuario.
 * @returns {Object[]} Acciones visibles para la interfaz.
 */
export function inferActions({ texto = "", resultados = [], estado, session, rol } = {}) {
  const actions = [];
  if (estado === "sin_informacion" || String(texto).includes(NO_INFO)) {
    actions.push({ tipo: "hablar_con_persona" });
  }
  const canRegisterComplaint = can(session?.rol || rol, "quejas", "crear");
  const requestedComplaint = isComplaintRequest(texto);
  const recoverableComplaintError = resultados.some((item) => {
    const toolName = item?.nombreServidor || item?.nombreHerramienta;
    const result = item?.resultado || item;
    return toolName === "registrar_queja"
      && result?.ok === false
      && result.tipo !== "sin_permiso";
  });
  if (canRegisterComplaint && (requestedComplaint || recoverableComplaintError)) {
    actions.push({ tipo: "registrar_queja" });
  }
  return actions;
}

/**
 * Clasifica una respuesta del modelo usando resultados locales de herramientas.
 * @param {Object} input Texto y resultados locales.
 * @returns {"ok"|"sin_informacion"|"ambiguo"} Estado de la respuesta.
 */
export function classifyState({ texto = "", resultados = [] } = {}) {
  if (resultados.some((item) => (item?.resultado || item)?.tipo === "ambiguo")) {
    return "ambiguo";
  }
  const answer = String(texto);
  if (answer.includes(REFUSAL_SENSITIVE) || answer.includes(REFUSAL_INJECTION)) {
    return "rechazado";
  }
  if (
    answer.includes(NO_INFO)
    || (!answer.trim() && resultados.length === 0)
  ) {
    return "sin_informacion";
  }
  return "ok";
}
