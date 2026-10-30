import { getSucursal, listSucursales } from "../../../data/repositories/sucursalesRepository.js";
import { formatDate, formatDateTime, formatMXN } from "../../../shared/utils/format.js";
import { assistantSwitch } from "../assistantSwitchRepository.js";
import {
  ASSISTANT_OFF,
  NO_INFO,
  REFUSAL_INJECTION,
  REFUSAL_SENSITIVE,
} from "../domain/guidelines.js";
import { createTools } from "../tools/chatTools.js";

function normalized(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX");
}

function answer(texto, estado = "respondido", fuentes = [], acciones = []) {
  return { texto, estado, fuentes, acciones };
}

function safeSources(result) {
  return result?.fuentes || [];
}

function branchMentioned(text, branches) {
  const query = normalized(text);
  return branches.find((branch) => query.includes(normalized(branch.ciudad))) || null;
}

function lastStockProduct(history = []) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index];
    if (message.role !== "assistant") continue;
    const action = (message.acciones || []).find((item) =>
      item.tipo === "consultar_existencias" && item.producto,
    );
    if (action) return action.producto;
  }
  return null;
}

function getStockResultText(result, session) {
  if (!result.ok && result.tipo === "sin_permiso") {
    return answer("Tu rol no tiene acceso a esa información.", "sin_permiso");
  }
  if (!result.ok && result.tipo === "fuera_de_alcance") {
    return answer(
      session.rol === "cliente"
        ? `Solo puedo informarte de la disponibilidad en tu sucursal (${result.sucursalPropia}).`
        : `Solo puedo consultar las existencias de tu sucursal (${result.sucursalPropia}).`,
      "fuera_de_alcance",
    );
  }
  if (!result.ok && result.tipo === "ambiguo") {
    const options = result.opciones.map((option) => `- ${option.nombre}`).join("\n");
    return answer(`¿A cuál presentación te refieres?\n${options}`, "ambiguo");
  }
  if (!result.ok) return answer(NO_INFO, "sin_informacion", [], [{ tipo: "hablar_con_persona" }]);

  if (session.rol === "cliente") {
    const stock = result.resultados[0];
    return answer(
      `${result.producto}: ${stock.disponibilidad} en tu sucursal (${stock.sucursal}).`,
      "respondido",
      safeSources(result),
      [{ tipo: "consultar_existencias", producto: result.producto }],
    );
  }
  const lines = result.resultados.map((stock) =>
    `En ${stock.sucursal} hay ${stock.disponible} unidades disponibles de ${result.producto} (${stock.existencia} en existencia y ${stock.comprometido} comprometidas en pedidos por surtir). Corte: ${formatDateTime(result.corte)}.`,
  );
  if (result.resultados.length > 1) {
    const total = result.resultados.reduce((sum, stock) => sum + stock.disponible, 0);
    lines.push(`Total: ${total} unidades disponibles de ${result.producto}.`);
  }
  return answer(
    lines.join("\n"),
    "respondido",
    safeSources(result),
    [{ tipo: "consultar_existencias", producto: result.producto }],
  );
}

function getPriceText(result) {
  if (!result.ok) {
    return result.tipo === "ambiguo"
      ? answer(`¿A cuál presentación te refieres?\n${result.opciones.map((item) => `- ${item.nombre}`).join("\n")}`, "ambiguo")
      : answer(NO_INFO, "sin_informacion", [], [{ tipo: "hablar_con_persona" }]);
  }
  let text = `${result.producto}: precio de lista ${formatMXN(result.precioLista)} + IVA (${formatMXN(result.ivaLista)}) = ${formatMXN(result.precioConIVA)}.`;
  if (result.totalConDescuento !== undefined) {
    text += ` Con tu descuento de ${result.descuentoPct}% por cliente ${result.tamanoCliente}: ${formatMXN(result.precioConDescuento)} + IVA (${formatMXN(result.ivaConDescuento)}) = ${formatMXN(result.totalConDescuento)}.`;
  }
  text += " Los precios son iguales en todas las sucursales.";
  return answer(text, "respondido", safeSources(result));
}

function getOrderText(result) {
  if (!result.ok) {
    return result.tipo === "sin_permiso"
      ? answer("Tu rol no tiene acceso a esa información.", "sin_permiso")
      : answer("No encontré ese pedido en tu cuenta.", "no_encontrado", [], [{ tipo: "hablar_con_persona" }]);
  }
  const orders = result.pedidos || [result];
  const lines = orders.map((order) => {
    const delivery = order.tipoEntrega === "envio_a_domicilio"
      ? "Entrega a domicilio"
      : "Para recoger en sucursal";
    let text = `El pedido ${order.folio} está ${order.estado.replaceAll("_", " ")}. ${delivery}. Entrega estimada: ${formatDate(order.fechaEntregaEstimada)}. Total: ${formatMXN(order.total)} (incluye IVA).`;
    if (order.surtidoEnOtraSucursal) text += ` Se surte desde ${order.sucursalSurtido}.`;
    return text;
  });
  return answer(
    lines.join("\n"),
    "respondido",
    result.fuentes || orders.flatMap((order) => order.fuentes || []),
    [],
  );
}

/**
 * Crea el proveedor simulado con la firma compatible con Azure.
 * @param {Object} deps Herramientas, interruptor y sucursales reemplazables.
 * @returns {{send:Function,respond:Function}} Funciones de respuesta.
 */
export function createMockChatProvider({
  tools = createTools(),
  switchRepository = assistantSwitch,
  branches = listSucursales(),
} = {}) {
  async function send({ texto, message, session, historial = [] } = {}) {
    const input = String(texto ?? message ?? "").trim();
    if (!switchRepository.isEnabled()) return answer(ASSISTANT_OFF, "apagado");
    const query = normalized(input);

    if (/\b(ignora tus reglas|olvida tus instrucciones|inventa precios|actua como|modo desarrollador)\b/.test(query)) {
      return answer(REFUSAL_INJECTION, "rechazado");
    }
    if (/\b(salario|sueldo|nomina|cuanto gana|rfc|contrasena|datos de otros clientes)\b/.test(query)) {
      return answer(REFUSAL_SENSITIVE, "rechazado");
    }
    if (/\b(persona|agente humano|gerente|asesor)\b/.test(query)) {
      const branch = getSucursal(session?.idSucursal);
      if (!branch) return answer(NO_INFO, "sin_informacion", [], [{ tipo: "hablar_con_persona" }]);
      return answer(
        `Con gusto. Puedes comunicarte con la sucursal ${branch.ciudad} al ${branch.telefono}.`,
        "respondido",
        [],
        [{ tipo: "hablar_con_persona" }],
      );
    }
    if (/\b(queja|reclamo|molesto|no me llego|mal servicio)\b/.test(query)) {
      const result = await tools.buscarPolitica({ consulta: "primera respuesta quejas" }, session);
      return answer(
        "Lamento el inconveniente. Puedo registrar tu queja; en horario de atención, el objetivo de primera respuesta es de 15 minutos.",
        "respondido",
        safeSources(result),
        [{ tipo: "registrar_queja" }],
      );
    }
    if (/\b(pedido|pedidos|folio|PED-\d+|RC-\d{4}-\d+)\b/.test(query)) {
      const reference = input.match(/\b(?:RC-\d{4}-\d{6}|PED-\d{6})\b/i)?.[0]
        || (/en\s+curso|pedidos?\s+pendientes?/i.test(input) ? "en_curso" : "mi_pedido");
      return getOrderText(await tools.estadoPedido({ referencia: reference }, session));
    }
    const shippingQuery = /\b(envio|entrega|flete)\b/.test(query);
    if (/\b(precio|cuesta|cuanto vale|costo)\b/.test(query) && !shippingQuery) {
      return getPriceText(await tools.consultarPrecio({ producto: input }, session));
    }
    const branch = branchMentioned(input, branches);
    const shortBranchFollowup = /^(?:y\s+)?(?:en\s+)?(?:guadalajara|zapopan|leon|queretaro|aguascalientes)$/
      .test(query.replace(/[¿?¡!.,]/g, "").trim());
    const followupStock = shortBranchFollowup && lastStockProduct(historial);
    if (followupStock || (
      /\b(hay|queda|existencia|stock|disponible|inventario)\b/.test(query)
      || /\b(cloro|blanqueador)\b/.test(query)
      || (/\b(cuanto|cuantos)\b/.test(query) && !/\b(dia|dias|tiempo)\b/.test(query))
      && !/\b(cuanto cuesta|precio)\b/.test(query)
    )) {
      const rememberedProduct = followupStock ? lastStockProduct(historial) : null;
      const result = await tools.consultarExistencias({
        producto: rememberedProduct || input,
        sucursal: branch?.ciudad,
      }, session);
      return getStockResultText(result, session);
    }
    if (/\b(politica|devolver|devolucion|envio|entrega|credito|factura|privacidad|datos personales|proveedor|pagos|aprobacion|accesos)\b/.test(query)) {
      const result = await tools.buscarPolitica({ consulta: input }, session);
      if (!result.resultados?.length) return answer(NO_INFO, "sin_informacion", [], [{ tipo: "hablar_con_persona" }]);
      const selected = result.resultados.slice(0, 2);
      const sources = selected.map((item) => item.fuente);
      const best = selected[0];
      return answer(
        `Según ${best.fuente.titulo} (v${best.fuente.version}): ${best.fragmento.texto}`,
        "respondido",
        sources,
      );
    }
    if (/^(hola|buenos dias|buenas tardes|buenas noches|gracias|muchas gracias)[!. ]*$/i.test(query)) {
      const name = session?.nombre || "usuario";
      return answer(`Hola ${name}, soy el asistente virtual (IA) de Río Claro. Puedo ayudarte con existencias, precios, pedidos y políticas.`);
    }
    return answer(NO_INFO, "sin_informacion", [], [{ tipo: "hablar_con_persona" }]);
  }

  return { send, sendMessage: send, respond: send };
}

export const mockChatProvider = createMockChatProvider();
