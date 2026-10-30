import { chatProvider } from "./services/chatProvider.js";
import { createChatRepository } from "./chatRepository.js";
import { assistantSwitch } from "./assistantSwitchRepository.js";
import { listSucursales } from "../../data/repositories/sucursalesRepository.js";
import { listPedidos } from "../../data/repositories/pedidosRepository.js";
import { getMiCliente } from "../../data/repositories/clientesRepository.js";
import { registerComplaint } from "../complaints/services/complaintService.js";
import { adminService } from "../admin/adminService.js";

const SEND_ERROR = "No pude responder en este momento. Intenta de nuevo o habla con una persona.";

function messageDate(now) {
  const value = typeof now === "function" ? now() : now;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/**
 * Crea el servicio de conversación para aislar componentes de proveedores y repositorios.
 * @param {Object} deps Proveedor, repositorios y reloj.
 * @returns {Object} Operaciones de chat.
 */
export function createChatService({
  provider = chatProvider,
  chatRepository = createChatRepository(),
  switchRepo = assistantSwitch,
  sucursales = listSucursales,
  now = () => new Date(),
  pedidos = { listPedidos },
  clientes = { getMiCliente },
  complaints = registerComplaint,
  admin = null,
} = {}) {
  function getHistory(session) {
    if (!session?.usuario) return [];
    return chatRepository.list(session.usuario);
  }

  async function send(texto, session) {
    const text = String(texto ?? "").trim();
    if (!text) throw new Error("Escribe un mensaje antes de enviarlo.");
    if (text.length > 500) throw new Error("El mensaje no puede superar los 500 caracteres.");
    if (!session?.usuario) throw new Error("Sesión requerida");

    const fecha = messageDate(now);
    chatRepository.append(session.usuario, {
      role: "user",
      texto: text,
      fuentes: [],
      acciones: [],
      estado: "enviado",
      fecha,
    });
    const historial = getHistory(session).slice(-8);
    let response;
    try {
      const request = { texto: text, session, historial };
      response = provider.sendMessage
        ? await provider.sendMessage(request)
        : await provider.send(request);
    } catch {
      response = {
        texto: SEND_ERROR,
        fuentes: [],
        acciones: [{ tipo: "hablar_con_persona" }],
        estado: "error",
      };
    }
    return chatRepository.append(session.usuario, {
      role: "assistant",
      texto: response.texto,
      fuentes: response.fuentes || [],
      acciones: response.acciones || [],
      estado: response.estado || "respondido",
      fecha: messageDate(now),
    });
  }

  function clear(session) {
    if (!session?.usuario) throw new Error("Sesión requerida");
    chatRepository.clear(session.usuario);
  }

  async function getContact(session) {
    if (!session?.idSucursal) return null;
    const branches = typeof sucursales === "function" ? await sucursales() : sucursales;
    const branch = branches.find((item) => item.id === session.idSucursal);
    return branch ? { nombre: branch.nombre, ciudad: branch.ciudad, telefono: branch.telefono } : null;
  }

  async function getComplaintOrders(session, idCliente) {
    if (!session) throw new Error("Sesión requerida");
    const client = session.rol === "cliente"
      ? await clientes.getMiCliente(session)
      : { idCliente };
    if (!client?.idCliente || (session.rol === "cliente" && client.idCliente !== session.idCliente)) {
      throw new Error("No se encontró el cliente dentro de tu alcance.");
    }
    return (await pedidos.listPedidos(session, { idCliente: client.idCliente }))
      .sort((a, b) => String(b.fechaPedido).localeCompare(String(a.fechaPedido)))
      .slice(0, 20)
      .map((order) => ({
        idPedido: order.idPedido,
        folio: order.folio,
        fechaPedido: order.fechaPedido,
        estado: order.estado,
      }));
  }

  async function submitComplaint(input, session) {
    const result = await complaints({ ...input, session });
    const source = { tipo: "politica", id: "POL-07", titulo: "Atención de quejas y seguimiento", version: "1.0" };
    const assistantMessage = `Registré tu queja ${result.folio} con prioridad ${result.prioridad}. Una persona le dará seguimiento; el objetivo de primera respuesta es de 15 minutos en horario de atención (POL-07).`;
    chatRepository.append(session.usuario, {
      role: "assistant",
      texto: assistantMessage,
      fuentes: [source],
      acciones: [],
      estado: "respondido",
      fecha: messageDate(now),
    });
    return result;
  }

  return {
    getHistory,
    send,
    clear,
    isEnabled: () => switchRepo.isEnabled(),
    setEnabled: (valor, session) => admin
      ? admin.setAssistantEnabled(session, valor)
      : switchRepo.setEnabled(valor, session),
    getContact,
    getComplaintOrders,
    registerComplaint: submitComplaint,
  };
}

export const chatService = createChatService({ admin: adminService });
