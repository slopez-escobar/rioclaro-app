import { ApiError, apiClient } from "../../../shared/api/apiClient.js";
import { assistantSwitch } from "../assistantSwitchRepository.js";
import { ASSISTANT_OFF, NO_INFO } from "../domain/guidelines.js";
import {
  classifyState,
  collectSources,
  compactToolResult,
  inferActions,
  toolCallToApp,
} from "../domain/azureChat.js";
import { getGuardrailResponse } from "../domain/guardrails.js";
import { createTools } from "../tools/chatTools.js";

const ITERATION_LIMIT_MESSAGE = "No pude completar la consulta. ¿Quieres que te pase con una persona?";
const TOOL_ERROR_MESSAGE = "No se pudo consultar esa información.";
const UNAVAILABLE_TOOL_MESSAGE = "Herramienta no disponible";
const SHORT_COMPLAINT_MESSAGE = "La descripción debe tener al menos 15 caracteres";
const MAX_RESPONSE_LENGTH = 1500;

function responseMessage(payload) {
  if (
    !payload
    || typeof payload !== "object"
    || !payload.message
    || typeof payload.message !== "object"
    || Array.isArray(payload.message)
  ) {
    throw new Error("La respuesta del servicio de chat no tiene el formato esperado.");
  }
  return payload.message;
}

function contentText(message) {
  if (typeof message.content !== "string") return "";
  return message.content.trim().slice(0, MAX_RESPONSE_LENGTH);
}

function historyMessages(historial, currentText) {
  const history = Array.isArray(historial) ? [...historial] : [];
  const last = history.at(-1);
  if (
    last?.role === "user"
    && String(last.texto ?? last.content ?? "") === currentText
  ) {
    history.pop();
  }
  return history
    .map((item) => {
      if (item?.role !== "user" && item?.role !== "assistant") return null;
      const content = item.role === "user"
        ? item.texto ?? item.content
        : item.texto ?? item.content;
      return typeof content === "string"
        ? { role: item.role, content }
        : null;
    })
    .filter(Boolean)
    .slice(-8);
}

function disabledServiceError(error) {
  return error instanceof ApiError
    && error.status === 503
    && error.mensaje === ASSISTANT_OFF;
}

function unavailableToolResult() {
  return { ok: false, tipo: "error", mensaje: UNAVAILABLE_TOOL_MESSAGE };
}

function failedToolResult(error, toolName) {
  const message = toolName === "registrar_queja"
    && error instanceof Error
    && error.message === SHORT_COMPLAINT_MESSAGE
    ? SHORT_COMPLAINT_MESSAGE
    : TOOL_ERROR_MESSAGE;
  return { ok: false, tipo: "error", mensaje: message };
}

async function toolResultMessage(toolCall, session, tools) {
  const name = toolCall?.function?.name;
  const translated = toolCallToApp(name, toolCall?.function?.arguments);
  if (translated.error) {
    return {
      content: compactToolResult(name, unavailableToolResult(), session),
      trackedResult: { nombreServidor: name, resultado: unavailableToolResult() },
    };
  }

  let result;
  try {
    const execute = tools[translated.herramienta];
    if (typeof execute !== "function") throw new Error("Herramienta local no disponible");
    result = await execute(translated.args, session);
  } catch (error) {
    result = failedToolResult(error, name);
  }
  return {
    content: compactToolResult(name, result, session),
    trackedResult: { nombreServidor: name, resultado: result },
  };
}

/**
 * Crea el proveedor de chat Azure con herramientas ejecutadas localmente.
 * @param {Object} options Cliente HTTP, herramientas, interruptor y límite de iteraciones.
 * @returns {{sendMessage:Function,send:Function,respond:Function}} Operaciones compatibles con el chat.
 */
export function createAzureChatProvider({
  client = apiClient,
  tools = createTools(),
  switchRepo = assistantSwitch,
  maxIteraciones = 4,
} = {}) {
  if (!Number.isInteger(maxIteraciones) || maxIteraciones < 1) {
    throw new Error("El máximo de iteraciones debe ser un entero positivo.");
  }

  async function sendMessage({
    historial = [],
    mensaje,
    texto,
    message,
    session,
  } = {}) {
    const input = String(texto ?? mensaje ?? message ?? "").trim();
    const guardrail = getGuardrailResponse(input, switchRepo.isEnabled());
    if (guardrail) {
      return {
        texto: guardrail.texto,
        fuentes: [],
        acciones: [],
        intent: "conversacion",
        estado: guardrail.estado,
      };
    }

    const messages = [...historyMessages(historial, input), { role: "user", content: input }];
    const resultados = [];
    let intent = "conversacion";

    for (let iteration = 0; iteration < maxIteraciones; iteration += 1) {
      let payload;
      try {
        payload = await client.request("/chat", {
          method: "POST",
          body: { messages },
        });
      } catch (error) {
        if (disabledServiceError(error)) {
          return {
            texto: ASSISTANT_OFF,
            fuentes: [],
            acciones: [],
            intent: "conversacion",
            estado: "apagado",
          };
        }
        throw error;
      }

      const messageFromModel = responseMessage(payload);
      if (messageFromModel.tool_calls !== undefined && !Array.isArray(messageFromModel.tool_calls)) {
        throw new Error("La respuesta del servicio de chat contiene herramientas inválidas.");
      }
      const toolCalls = messageFromModel.tool_calls || [];
      if (!toolCalls.length) {
        const answerText = contentText(messageFromModel) || NO_INFO;
        const estado = classifyState({ texto: answerText, resultados });
        return {
          texto: answerText,
          fuentes: collectSources(resultados),
          acciones: inferActions({ texto: answerText, resultados, estado, session }),
          intent,
          estado,
        };
      }

      messages.push({
        role: "assistant",
        content: typeof messageFromModel.content === "string" ? messageFromModel.content : null,
        tool_calls: toolCalls,
      });
      for (const call of toolCalls) {
        if (!call || typeof call.id !== "string") {
          throw new Error("La respuesta del servicio de chat contiene una herramienta inválida.");
        }
        const { content, trackedResult } = await toolResultMessage(call, session, tools);
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content,
        });
        resultados.push(trackedResult);
        intent = call.function?.name || "conversacion";
      }
    }

    const actions = inferActions({
      texto: ITERATION_LIMIT_MESSAGE,
      resultados,
      estado: "sin_informacion",
      session,
    });
    if (!actions.some((action) => action.tipo === "hablar_con_persona")) {
      actions.push({ tipo: "hablar_con_persona" });
    }
    return {
      texto: ITERATION_LIMIT_MESSAGE,
      fuentes: collectSources(resultados),
      acciones: actions,
      intent,
      estado: "sin_informacion",
    };
  }

  return {
    sendMessage,
    send: sendMessage,
    respond: sendMessage,
  };
}

export const azureChatProvider = createAzureChatProvider();
