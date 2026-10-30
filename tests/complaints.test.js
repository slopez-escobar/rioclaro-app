import { describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "../src/config/constants.js";
import { getMiCliente, listClientes } from "../src/data/repositories/clientesRepository.js";
import { listPedidos } from "../src/data/repositories/pedidosRepository.js";
import { createComplaintRepository } from "../src/features/complaints/complaintRepository.js";
import { buildComplaint } from "../src/features/complaints/domain/buildComplaint.js";
import { registerComplaint } from "../src/features/complaints/services/complaintService.js";
import { getBaseCount } from "../src/data/repositories/quejasRepository.js";
import { memoryStore, sessionFor } from "./chatTestUtils.js";

const fixedNow = () => "2026-10-26T10:00";

describe("registro de quejas desde el asistente", () => {
  it("construye el formato base, infiere tema y calcula prioridad", () => {
    const record = buildComplaint({
      session: sessionFor("cliente1"),
      cliente: { idCliente: "CLI-1", idSucursal: "gdl", tamano: "grande" },
      pedido: {
        idPedido: "PED-000001",
        folio: "RC-2026-000001",
        idSucursalSurtido: "leo",
        resumen: { total: 17500 },
      },
      descripcion: "El pedido no llegó y el repartidor no llegó",
      numero: 222,
      ahora: fixedNow(),
    });
    expect(record).toMatchObject({
      idQueja: "QJA-0222",
      folio: "QJ-2026-0222",
      fechaQueja: "2026-10-26T10:00",
      tema: "entrega_fallida",
      prioridad: "alta",
      idSucursalSurtido: "leo",
      surtidoEnOtraSucursal: true,
      canal: "asistente",
      estatus: "abierta",
    });
    expect(record.respuestas).toEqual([]);
  });

  it("registra folios consecutivos en el repositorio y no altera el conteo base", async () => {
    const store = memoryStore();
    const complaints = createComplaintRepository({ store, baseCount: 221 });
    const session = sessionFor("cliente1");
    const orders = await listPedidos(session);
    const saved = await registerComplaint({
      session,
      descripcion: "No llegó el pedido y no me avisaron",
      idPedido: orders[0].idPedido,
    }, {
      clientes: { getMiCliente },
      pedidos: { getPedido: async (_session, id) => orders.find((order) => order.idPedido === id) || null },
      complaints,
      now: fixedNow,
    });
    expect(saved).toMatchObject({ ok: true, folio: "QJ-2026-0222", prioridad: "alta" });
    const stored = store.get(STORAGE_KEYS.complaints);
    expect(stored.items[0].idQueja).toBe("QJA-0222");
    expect(JSON.stringify(stored)).not.toMatch(/password|salarioMensualMXN|correoInstitucional|nombreEmpleado/i);
    expect((await complaints.listNuevas())[0].idQueja).toBe("QJA-0222");
    expect(await complaints.nextNumber()).toBe(223);
    expect(await getBaseCount()).toBe(221);
  });

  it("valida descripción, permisos, clientes y pedidos dentro del alcance", async () => {
    const client = sessionFor("cliente1");
    const ownOrders = await listPedidos(client);
    const otherOrder = (await listPedidos(sessionFor("ernesto"))).find((order) => order.idCliente !== client.idCliente);
    const complaints = createComplaintRepository({ store: memoryStore(), baseCount: 221 });
    const deps = {
      complaints,
      now: fixedNow,
    };
    await expect(registerComplaint({ session: client, descripcion: "muy corto" }, deps))
      .rejects.toThrow("La descripción debe tener al menos 15 caracteres");
    await expect(registerComplaint({
      session: client,
      descripcion: "El pedido llegó equivocado",
      idPedido: otherOrder.idPedido,
    }, deps)).rejects.toThrow("El pedido no pertenece a ese cliente o está fuera de tu alcance");
    await expect(registerComplaint({
      session: client,
      idCliente: otherOrder.idCliente,
      descripcion: "El pedido llegó equivocado",
    }, deps)).rejects.toThrow("Solo puedes registrar quejas para tu propia cuenta");

    const tono = sessionFor("tono");
    await expect(registerComplaint({
      session: tono,
      idCliente: "CLI-0001",
      descripcion: "La entrega llegó equivocada",
    }, deps)).rejects.toThrow("Tu rol no puede registrar quejas");

    const mariana = sessionFor("mariana");
    const leonClient = (await listClientes(mariana)).find((item) => item.idSucursal === "leo");
    const qroClient = (await listClientes(sessionFor("ernesto"))).find((item) => item.idSucursal === "qro");
    const authorizedDeps = {
      ...deps,
      clientes: { getCliente: async (_session, id) => (await listClientes(sessionFor("ernesto"))).find((c) => c.idCliente === id && c.idSucursal === "leo") || null },
      pedidos: { getPedido: async () => null },
    };
    const allowed = await registerComplaint({
      session: mariana,
      idCliente: leonClient.idCliente,
      descripcion: "La entrega llegó equivocada",
    }, authorizedDeps);
    expect(allowed.ok).toBe(true);
    await expect(registerComplaint({
      session: mariana,
      idCliente: qroClient.idCliente,
      descripcion: "La entrega llegó equivocada",
    }, authorizedDeps)).rejects.toThrow("El cliente no existe o está fuera de tu alcance");
  });

  it("usa el primer número disponible y reporta errores de cuota en español", () => {
    const repo = createComplaintRepository({ store: memoryStore(), baseCount: 221 });
    expect(repo.nextNumber()).toBe(222);
    const quotaRepo = createComplaintRepository({
      store: { get: () => null, set: () => ({ ok: false, error: "cuota" }) },
      baseCount: 221,
    });
    expect(() => quotaRepo.add({ folio: "QJ-2026-0222" }))
      .toThrow("No se pudo guardar la queja porque el almacenamiento está lleno.");
  });
});
