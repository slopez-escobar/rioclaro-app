const STOP_WORDS = new Set([
  "a", "al", "algo", "como", "con", "cual", "cuales", "cuan", "cuando",
  "cuanto", "cuantos", "de", "del", "desde", "donde", "el", "ella", "en",
  "es", "esta", "este", "la", "las", "lo", "los", "mas", "me", "mi", "mis",
  "muy", "pedi", "pedir", "puedo", "quien", "quienes", "tengo", "usan",
  "o", "para", "por", "que", "se", "si", "sin", "su", "sus", "un", "una",
  "unas", "uno", "unos", "y",
]);

const SYNONYM_GROUPS = [
  ["plazo", "devolver", "devuelve", "devolucion", "devoluciones", "reembolso", "reembolsar", "reembolsos", "plazo"],
  ["envio", "envio", "envios", "entrega", "entregar", "entregas", "domicilio", "flete", "repartidor", "reparto"],
  ["recoger", "recoger", "recogida", "mostrador"],
  ["credito", "credito", "creditos", "vencido", "vencida", "cobranza", "cobrar", "pagar", "pago"],
  ["factura", "factura", "facturar", "facturacion", "cfdi"],
  ["cancelar", "cancelar", "cancelo", "cancelacion", "cancelaciones", "cancelado"],
  ["precio", "descuento", "descuento", "descuentos", "precio", "precios", "iva", "lista"],
  ["queja", "queja", "quejas", "reclamo", "reclamos", "molesto", "molestia"],
  ["privacidad", "privacidad", "privado", "personal", "personales", "arco", "proteccion"],
  ["asistente", "asistente", "ia", "inteligencia", "artificial", "chatbot"],
  ["proveedor", "proveedor", "proveedores", "compras", "compra", "adquisicion"],
  ["aprobacion", "aprobacion", "aprobar", "aprueba", "apruebe", "aprobado", "pagos", "pago"],
  ["inventario", "inventario", "existencias", "existencia", "reorden", "conteo", "stock"],
  ["acceso", "accesos", "contrasena", "usuario", "cuenta", "cuentas"],
  ["respuesta", "responder", "responden", "responde", "respuesta", "respuestas", "contestar"],
  ["costo", "costo", "costos", "cuesta", "costar", "gratis", "gratuito", "gratuita"],
  ["peso", "pesos", "peso", "importe", "monto"],
  ["surtir", "surtido", "surte", "surtir"],
  ["pedido", "pedido", "pedidos", "orden", "ordenes"],
  ["comprar", "comprar", "compro", "compra", "compras"],
];
const SYNONYMS = new Map();
for (const [canonical, ...words] of SYNONYM_GROUPS) {
  for (const word of words) SYNONYMS.set(word, canonical);
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX")
    .replace(/\bnota\s+de\s+credito\b/g, " devolucion ")
    .replace(/\$?\s*(\d{1,3}(?:,\d{3})+)(?:\.\d+)?/g, (amount) =>
      amount.replace(/^\$?\s*/, "").replace(/,/g, "").replace(/\.\d+$/, ""),
    )
    .replace(/(\d+)\s+mil\b/g, (_, amount) => String(Number(amount) * 1000))
    .replace(/[^\p{L}\p{N}\s]/gu, " ");
}

function tokens(value) {
  return normalizeText(value)
    .split(/\s+/)
    .filter((token) => token && !STOP_WORDS.has(token))
    .map((token) => SYNONYMS.get(token) || token);
}

function tokenSet(value) {
  return new Set(tokens(value));
}

function scoreFragment(queryTokens, fragment) {
  const theme = tokenSet(fragment.tema);
  const title = tokenSet(fragment.titulo);
  const text = tokenSet(fragment.texto);
  let score = 0;
  let maximum = 0;
  for (const token of queryTokens) {
    maximum += 3;
    if (theme.has(token)) score += 3;
    else if (title.has(token)) score += 2;
    else if (text.has(token)) score += 1;
  }
  return score / maximum;
}

/**
 * Recupera los fragmentos más relacionados con una consulta en español.
 * @param {string} consulta Pregunta del usuario.
 * @param {Object[]} fragmentos Fragmentos autorizados y citables.
 * @param {{max?:number,minimo?:number}} options Límite y puntaje mínimo.
 * @returns {{fragmento:Object,puntaje:number}[]} Resultados ordenados.
 */
export function searchPolicies(consulta, fragmentos, { max = 3, minimo = 0.34 } = {}) {
  const queryTokens = [...new Set(tokens(consulta))];
  if (!queryTokens.length || max <= 0) return [];
  const supplierPaymentQuery = queryTokens.includes("proveedor") && queryTokens.includes("aprobacion");
  return fragmentos
    .filter((fragment) => {
      if (!supplierPaymentQuery) return true;
      const content = tokenSet(`${fragment.tema} ${fragment.titulo} ${fragment.texto}`);
      return content.has("proveedor") && content.has("aprobacion");
    })
    .map((fragmento) => ({ fragmento, puntaje: scoreFragment(queryTokens, fragmento) }))
    .filter((result) => result.puntaje >= minimo)
    .sort((a, b) =>
      b.puntaje - a.puntaje
      || Number(b.fragmento.seccion === "Reglas") - Number(a.fragmento.seccion === "Reglas")
      || a.fragmento.id.localeCompare(b.fragmento.id),
    )
    .slice(0, max);
}
