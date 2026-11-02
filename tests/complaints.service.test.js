import { describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "../src/config/constants.js";
import { createComplaintActionsRepository } from "../src/features/complaints/complaintActionsRepository.js";
import { createComplaintRepository } from "../src/features/complaints/complaintRepository.js";
import { createComplaintService } from "../src/features/complaints/complaintService.js";
import { createMockSentiment } from "../src/features/complaints/services/sentiment.mock.js";
import { registerComplaint } from "../src/features/complaints/services/complaintService.js";
import * as clientesRepo from "../src/data/repositories/clientesRepository.js";
import * as quejasRepo from "../src/data/repositories/quejasRepository.js";
import { canAct } from "../src/features/complaints/domain/index.js";
import { minutesBetween, formatLocalMinute } from "../src/shared/utils/time.js";
import { quejas as sourceComplaints } from "../src/data/source/quejas.json";
import { usuarios } from "../src/features/auth/data/usuarios.json";
import { memoryStore, sessionFor } from "./chatTestUtils.js";

const fixedNow = () => "2026-10-26T10:00";

function createService(store = memoryStore()) {
  const complaintRepo = createComplaintRepository({ store, baseCount: sourceComplaints.length });
  const actionsRepo = createComplaintActionsRepository({ store });
  const service = createComplaintService({
    quejasRepo,
    complaintRepo,
    actionsRepo,
    clientesRepo,
    sentiment: createMockSentiment(),
    now: fixedNow,
  });
  return { service, complaintRepo, actionsRepo, store };
}

function loginForAccount(account) {
  return sessionFor(account.usuario);
}

describe("repositorio de acciones de quejas", () => {
  it("persiste y lista acciones; reinicia estados dañados o de otra versión", () => {
    const store = memoryStore();
    const repository = createComplaintActionsRepository({ store });
    repository.append("QJA-1", { accion: "responder", comentario: "Recibido" });
    expect(repository.listFor("QJA-1")).toHaveLength(1);
    expect(repository.listAll()).toMatchObject({
      "QJA-1": [{ accion: "responder", comentario: "Recibido" }],
    });

    store.set(STORAGE_KEYS.complaintActions, { version: 2, acciones: { "QJA-2": [] } });
    expect(repository.listAll()).toEqual({});
    store.set(STORAGE_KEYS.complaintActions, "no es estado válido");
    expect(repository.listFor("QJA-2")).toEqual([]);
  });

  it("reporta explícitamente cuando se llena el almacenamiento", () => {
    const repository = createComplaintActionsRepository({
      store: { get: () => null, set: () => ({ ok: false, error: "cuota" }), remove() {} },
    });
    expect(() => repository.append("QJA-1", { accion: "responder" }))
      .toThrow("No se pudo guardar: el almacenamiento del navegador está lleno. Usa 'Restablecer demo de quejas'.");
  });
});

describe("servicio de quejas y alcance", () => {
  it("conserva los indicadores base de dirección y deniega los roles sin lectura", async () => {
    const { service } = createService();
    const session = sessionFor("ernesto");
    const indicators = await service.kpis(session);
    expect(indicators).toMatchObject({
      total: 221,
      porEstatus: { cerrada: 122, resuelta: 61, escalada: 16, abierta: 11, en_atencion: 11 },
      porPrioridad: { baja: 118, media: 63, alta: 40 },
      casosRepetidos: sourceComplaints.filter((item) => item.casoRepetido).length,
      primeraRespuesta: { conRespuesta: 210, cumplen15: 48, porcentaje: 23 },
    });
    expect(indicators.gruposRepetidos).toBeGreaterThan(0);
    expect(await service.list(session)).toHaveLength(221);
    await expect(service.list(sessionFor("laura"))).rejects.toThrow("No tienes permiso para ver quejas");
    await expect(service.list(sessionFor("tono"))).rejects.toThrow("No tienes permiso para ver quejas");
    await expect(service.list(sessionFor("cliente1"))).rejects.toThrow("No tienes permiso para ver quejas");
    await expect(service.act(session, sourceComplaints.find((item) => item.estatus === "abierta").idQueja, {
      accion: "responder", comentario: "Atención registrada correctamente.",
    })).rejects.toThrow("Tu rol no puede atender quejas");
  });

  it("limita las quejas de gerencia a la sucursal de su sesión", async () => {
    const { service } = createService();
    const mariana = sessionFor("mariana");
    const visible = await service.list(mariana);
    const expected = sourceComplaints.filter((item) =>
      item.idSucursal === mariana.idSucursal || item.idSucursalSurtido === mariana.idSucursal);
    expect(visible.map((item) => item.idQueja).sort())
      .toEqual(expected.map((item) => item.idQueja).sort());
    expect(visible.every((item) =>
      item.idSucursal === "leo" || item.idSucursalSurtido === "leo")).toBe(true);
    expect(visible.filter((item) => ["abierta", "en_atencion", "escalada"].includes(item.estatus))
      .every((item) => item.accionesPermitidas.responder.permitido)).toBe(true);
    expect((await service.get(mariana, "QJA-0001"))).toBeNull();
  });

  it("aplica y reproduce el flujo de atención sin modificar la base", async () => {
    const store = memoryStore();
    const { service, actionsRepo } = createService(store);
    const mariana = sessionFor("mariana");
    const original = sourceComplaints.find((item) =>
      item.estatus === "abierta"
      && (item.idSucursal === "leo" || item.idSucursalSurtido === "leo"));
    expect(original).toBeTruthy();
    const snapshot = JSON.stringify(original);

    const answered = await service.act(mariana, original.idQueja, {
      accion: "responder",
      comentario: "Recibimos su queja y ya iniciamos la revisión.",
    });
    expect(answered).toMatchObject({
      estatus: "en_atencion",
      cumpleObjetivo15min: false,
      tiempoPrimeraRespuestaMin: minutesBetween(original.fechaQueja, fixedNow()),
    });
    expect(await service.kpis(sessionFor("ernesto"))).toMatchObject({
      primeraRespuesta: { conRespuesta: 211, cumplen15: 48, porcentaje: 23 },
    });

    await service.act(mariana, original.idQueja, {
      accion: "escalar",
      comentario: "Escalamos este asunto para revisión de gerencia.",
    });
    const attentionAccount = usuarios.find((user) => user.puesto === "Atención a clientes");
    const attention = loginForAccount(attentionAccount);
    const escalated = (await service.get(mariana, original.idQueja));
    expect(canAct(attention, escalated, "resolver").motivo)
      .toBe("Una queja escalada solo la resuelve la gerencia");
    await service.act(mariana, original.idQueja, {
      accion: "resolver",
      comentario: "Confirmamos la solución y notificamos al cliente.",
    });
    const closed = await service.act(mariana, original.idQueja, {
      accion: "cerrar",
      calificacion: 5,
    });
    expect(closed).toMatchObject({ estatus: "cerrada", calificacionCliente: 5 });
    expect(closed.respuestas.at(-1)).toMatchObject({
      tipo: "cierre",
      autor: { tipo: "cliente", id: original.idCliente, nombre: "Cliente" },
      comentario: "El cliente confirmó la solución.",
    });
    expect(JSON.stringify(sourceComplaints.find((item) => item.idQueja === original.idQueja)))
      .toBe(snapshot);
    expect(actionsRepo.listFor(original.idQueja)).toHaveLength(4);

    const restartedService = createService(store).service;
    expect(await restartedService.get(mariana, original.idQueja))
      .toMatchObject({ estatus: "cerrada", calificacionCliente: 5 });
    const resetState = await restartedService.reset(mariana);
    expect(resetState).toHaveLength((await quejasRepo.listQuejas(mariana)).length);
    expect(actionsRepo.listAll()).toEqual({});
    expect(await restartedService.get(mariana, original.idQueja)).toMatchObject({
      estatus: "abierta",
      fechaPrimeraRespuesta: null,
    });
  });

  it("integra nuevas quejas del asistente, prioridad, sentimiento y repetidos", async () => {
    const store = memoryStore();
    const complaintRepo = createComplaintRepository({ store, baseCount: 221 });
    const client = sessionFor("cliente1");
    const description = "No hay existencia y el pedido llegó tarde, solicito ayuda.";
    const deps = { clientes: clientesRepo, complaints: complaintRepo, now: fixedNow };
    const first = await registerComplaint({ session: client, descripcion: description }, deps);
    const second = await registerComplaint({ session: client, descripcion: description }, deps);
    expect(first.folio).toBe("QJ-2026-0222");

    const managerAccount = usuarios.find((user) =>
      user.rol === "gerente_sucursal" && user.idSucursal === "gdl");
    const manager = loginForAccount(managerAccount);
    const service = createService(store).service;
    const visible = await service.list(manager);
    const newComplaint = visible.find((item) => item.idQueja === first.idQueja);
    expect(newComplaint).toMatchObject({
      acuseAutomatico: true,
      prioridad: "alta",
      casoRepetido: true,
      repetido: { total: 2 },
      sentimiento: { sentimiento: "negativo" },
    });
    expect(visible.find((item) => item.idQueja === second.idQueja).casoRepetido).toBe(true);
    expect(await service.get(sessionFor("mariana"), first.idQueja)).toBeNull();
    expect(JSON.stringify({
      complaints: await complaintRepo.listNuevas(),
      actions: createComplaintActionsRepository({ store }).listAll(),
    })).not.toMatch(/password|salario|rfc|correoInstitucional/i);

    await service.reset(manager);
    expect(await complaintRepo.listNuevas()).toEqual([]);
  });

  it("no cachea sin_analizar y reintenta solo al abrir el detalle", async () => {
    const complaint = sourceComplaints[0];
    const sentiment = {
      analyze: vi.fn()
        .mockResolvedValueOnce({ sentimiento: "sin_analizar", confianza: 0, frasesClave: [], origen: "no_disponible" })
        .mockResolvedValue({ sentimiento: "neutral", confianza: 0.6, frasesClave: [], origen: "azure-language" }),
    };
    const service = createComplaintService({
      quejasRepo: { listQuejas: async () => [complaint] },
      complaintRepo: { listNuevas: () => [] },
      actionsRepo: { listAll: () => ({}) },
      clientesRepo: { getCliente: async () => null },
      sentiment,
      now: fixedNow,
    });
    const session = sessionFor("ernesto");

    const listed = await service.list(session);
    expect(listed[0].sentimiento.sentimiento).toBe("sin_analizar");
    expect(sentiment.analyze).toHaveBeenCalledOnce();

    const detail = await service.get(session, complaint.idQueja);
    expect(detail.sentimiento.sentimiento).toBe("neutral");
    expect(sentiment.analyze).toHaveBeenCalledTimes(2);
    await service.get(session, complaint.idQueja);
    expect(sentiment.analyze).toHaveBeenCalledTimes(2);
  });
});

describe("utilidades de tiempo local", () => {
  it("formatea hora local y calcula minutos enteros sin valores negativos", () => {
    expect(formatLocalMinute(new Date(2026, 9, 26, 10, 4))).toBe("2026-10-26T10:04");
    expect(minutesBetween("2026-10-26T09:45", "2026-10-26T10:00")).toBe(15);
    expect(minutesBetween("2026-10-26T10:00", "2026-10-26T09:45")).toBe(0);
  });
});
