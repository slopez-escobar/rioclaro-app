import { can } from "../../auth/permissions.js";
import { buildComplaint } from "../domain/buildComplaint.js";
import { getComplaintRepository } from "../complaintRepository.js";

/**
 * Valida alcance y registra una queja del cliente o de un empleado autorizado.
 * @param {Object} input Sesión y datos de la queja.
 * @param {Object} deps Repositorios, almacenamiento y reloj inyectables.
 * @returns {Promise<Object>} Folio y prioridad asignados.
 */
export async function registerComplaint(
  { session, descripcion, idPedido = null, idCliente = null },
  deps = {},
) {
  if (!session) throw new Error("Sesión requerida");
  if (String(descripcion ?? "").trim().length < 15) {
    throw new Error("La descripción debe tener al menos 15 caracteres");
  }
  if (!can(session.rol, "quejas", "crear")) {
    throw new Error("Tu rol no puede registrar quejas");
  }

  let customerId = idCliente;
  if (session.rol === "cliente") {
    if (customerId && customerId !== session.idCliente) {
      throw new Error("Solo puedes registrar quejas para tu propia cuenta");
    }
    customerId = session.idCliente;
  } else if (!customerId) {
    throw new Error("Debes indicar el cliente de la queja");
  }

  const customerRepository = deps.clientes
    || deps.repos?.clientes
    || (await import("../../../data/repositories/clientesRepository.js"));
  const orderRepository = deps.pedidos
    || deps.repos?.pedidos
    || (await import("../../../data/repositories/pedidosRepository.js"));
  const client = session.rol === "cliente"
    ? await customerRepository.getMiCliente(session)
    : await customerRepository.getCliente(session, customerId);
  if (!client || client.idCliente !== customerId) {
    throw new Error("El cliente no existe o está fuera de tu alcance");
  }

  let order = null;
  if (idPedido) {
    order = await orderRepository.getPedido(session, idPedido);
    if (!order || order.idCliente !== customerId) {
      throw new Error("El pedido no pertenece a ese cliente o está fuera de tu alcance");
    }
  }

  const complaintRepo = deps.complaints
    || deps.repository
    || await getComplaintRepository();
  const number = await complaintRepo.nextNumber();
  const currentTime = deps.now ? deps.now() : new Date();
  const timestamp = currentTime instanceof Date ? currentTime.toISOString() : String(currentTime);
  const record = buildComplaint({
    session,
    cliente: client,
    pedido: order,
    descripcion,
    numero: number,
    ahora: timestamp,
  });
  await complaintRepo.add(record);
  return {
    ok: true,
    idQueja: record.idQueja,
    folio: record.folio,
    prioridad: record.prioridad,
  };
}
