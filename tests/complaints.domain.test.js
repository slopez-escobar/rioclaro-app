import { describe, expect, it } from "vitest";
import {
  applyAction,
  canAct,
  canAttend,
  evaluateFirstResponse,
  findRepeatedCases,
  priorityOf,
  replayActions,
  sortComplaints,
} from "../src/features/complaints/domain/index.js";
import { quejas } from "../src/data/source/quejas.json";
import { usuarios } from "../src/features/auth/data/usuarios.json";
import { sessionFor } from "./chatTestUtils.js";

const attentionUser = usuarios.find((user) => user.puesto === "Atención a clientes");
const attention = sessionFor(attentionUser.usuario);

function firstComplaint(status = "abierta") {
  const source = quejas.find((item) => item.estatus === status);
  return structuredClone(source);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

describe("reglas puras de quejas", () => {
  it("calcula prioridad por monto y tamaño", () => {
    expect(priorityOf({ monto: 14999.99 })).toBe("media");
    expect(priorityOf({ monto: 15000 })).toBe("alta");
    expect(priorityOf({ monto: 4999.99 })).toBe("baja");
    expect(priorityOf({ monto: 5000 })).toBe("media");
    expect(priorityOf({ tamano: "grande", monto: 0 })).toBe("alta");
    expect(priorityOf({ tamano: "mediano", monto: 0 })).toBe("media");
  });

  it("evalúa respuesta cumplida, incumplida, en tiempo y vencida", () => {
    expect(evaluateFirstResponse({
      fechaPrimeraRespuesta: "2026-10-26T10:10",
      tiempoPrimeraRespuestaMin: 10,
    }, "2026-10-26T10:20")).toEqual({ estado: "cumplida", minutos: 10 });
    expect(evaluateFirstResponse({
      fechaPrimeraRespuesta: "2026-10-26T10:20",
      tiempoPrimeraRespuestaMin: 20,
    }, "2026-10-26T10:30")).toEqual({ estado: "incumplida", minutos: 20 });
    expect(evaluateFirstResponse({
      fechaQueja: "2026-10-26T09:50",
      fechaPrimeraRespuesta: null,
    }, "2026-10-26T10:05")).toEqual({ estado: "en_tiempo", minutos: 15 });
    expect(evaluateFirstResponse({
      fechaQueja: "2026-10-26T09:40",
      fechaPrimeraRespuesta: null,
    }, "2026-10-26T10:00")).toEqual({ estado: "vencida", minutos: 20 });
  });

  it("ordena activas, resueltas y cerradas por prioridad y antigüedad", () => {
    const records = [
      { idQueja: "closed", estatus: "cerrada", prioridad: "alta", fechaQueja: "2020-01-01" },
      { idQueja: "low", estatus: "abierta", prioridad: "baja", fechaQueja: "2020-01-01" },
      { idQueja: "high-new", estatus: "escalada", prioridad: "alta", fechaQueja: "2020-02-01" },
      { idQueja: "resolved", estatus: "resuelta", prioridad: "baja", fechaQueja: "2020-01-01" },
      { idQueja: "high-old", estatus: "en_atencion", prioridad: "alta", fechaQueja: "2020-01-01" },
    ];
    expect(sortComplaints(records).map((item) => item.idQueja))
      .toEqual(["high-old", "high-new", "low", "resolved", "closed"]);
    expect(records[0].idQueja).toBe("closed");
  });

  it("detecta exactamente los grupos repetidos de las quejas base", () => {
    const result = findRepeatedCases(quejas);
    const marked = quejas.filter((item) => item.casoRepetido);
    expect([...result.porQueja.keys()].sort())
      .toEqual(marked.map((item) => item.idQueja).sort());
    for (const complaint of marked) {
      expect(result.porQueja.get(complaint.idQueja).ids
        .filter((id) => id !== complaint.idQueja).sort())
        .toEqual([...complaint.quejasRelacionadas].sort());
    }
    expect(findRepeatedCases([
      { idQueja: "a", idCliente: "c1", tema: "sin_clasificar" },
      { idQueja: "b", idCliente: "c1", tema: "sin_clasificar" },
    ]).grupos).toEqual([]);
  });
});

describe("acciones de atención", () => {
  it("permite atender por rol o puesto, sin extender el permiso a otros perfiles", () => {
    expect(canAttend(sessionFor("mariana"))).toBe(true);
    expect(canAttend(attention)).toBe(true);
    const supervisor = { ...attention, puesto: "Supervisor de ventas" };
    expect(canAttend(supervisor)).toBe(true);
    expect(canAttend(sessionFor("carmen.ramos"))).toBe(false);
    expect(canAttend(sessionFor("ernesto"))).toBe(false);
    expect(canAttend(sessionFor("tono"))).toBe(false);
  });

  it("devuelve los motivos y mensajes exactos para permisos y estados", () => {
    const open = firstComplaint("abierta");
    const resolved = firstComplaint("resuelta");
    const escalated = firstComplaint("escalada");
    const closed = firstComplaint("cerrada");
    expect(canAct(sessionFor("ernesto"), open, "responder").motivo)
      .toBe("Tu rol no puede atender quejas");
    expect(canAct(attention, closed, "responder").motivo).toBe("La queja ya está cerrada");
    expect(canAct(attention, resolved, "responder").motivo)
      .toBe("La queja ya tiene una respuesta final");
    expect(canAct(attention, escalated, "escalar").motivo).toBe("La queja ya está escalada");
    expect(canAct(attention, open, "cerrar").motivo)
      .toBe("Solo se puede cerrar una queja resuelta");
  });

  it("valida las acciones y sus comentarios mínimos", () => {
    const session = sessionFor("mariana");
    const open = firstComplaint("abierta");
    expect(() => applyAction(open, {
      accion: "responder", session, comentario: "abc", ahora: "2026-10-26T10:00",
    })).toThrow("El comentario es obligatorio (mínimo 5 caracteres)");
    expect(() => applyAction(open, {
      accion: "escalar", session, comentario: "breve", ahora: "2026-10-26T10:00",
    })).toThrow("El comentario es obligatorio (mínimo 10 caracteres)");
    const answered = applyAction(open, {
      accion: "responder", session, comentario: "Recibimos su queja.", ahora: "2026-10-26T10:00",
    });
    expect(() => applyAction(answered, {
      accion: "resolver", session, comentario: "Solución parcial.",
      ahora: "2026-10-26T10:00",
    })).toThrow("El comentario es obligatorio (mínimo 20 caracteres)");
    expect(() => applyAction(firstComplaint("resuelta"), {
      accion: "cerrar", session, calificacion: 6, ahora: "2026-10-26T10:00",
    })).toThrow("La calificación debe ser de 1 a 5");
    expect(() => applyAction(open, {
      accion: "resolver", session, comentario: "El cliente ya recibió una respuesta.",
      ahora: "2026-10-26T10:00",
    })).toThrow("Primero responde al cliente");
  });

  it("solo gerencia resuelve una queja escalada", () => {
    const session = sessionFor("mariana");
    const escalated = {
      ...firstComplaint("escalada"),
      respuestas: [{
        fecha: "2026-10-23T09:00",
        tipo: "acuse",
        autor: { tipo: "empleado", id: "RC-0001", nombre: "Empleado", puesto: "Atención a clientes" },
        comentario: "Ya recibimos su solicitud.",
      }],
    };
    expect(canAct(attention, escalated, "resolver").motivo)
      .toBe("Una queja escalada solo la resuelve la gerencia");
    expect(canAct(session, escalated, "resolver").permitido).toBe(true);
  });

  it("aplica acciones inmutablemente, fija primera respuesta y reproduce el mismo resultado", () => {
    const session = sessionFor("mariana");
    const original = deepFreeze(firstComplaint("abierta"));
    const reply = {
      accion: "responder",
      session,
      comentario: "Recibimos su queja y la estamos revisando.",
      ahora: "2026-10-26T10:00",
    };
    const answered = applyAction(original, reply);
    expect(answered).not.toBe(original);
    expect(answered.estatus).toBe("en_atencion");
    expect(answered.fechaPrimeraRespuesta).toBe(reply.ahora);
    expect(answered.cumpleObjetivo15min).toBe(false);
    expect(answered.respuestas.at(-1)).toMatchObject({
      tipo: "acuse",
      autor: { tipo: "empleado", id: session.idEmpleado, nombre: session.nombre },
    });

    const escalated = applyAction(answered, {
      accion: "escalar", session, comentario: "Escalamos el caso con gerencia.",
      ahora: "2026-10-26T10:01",
    });
    const resolved = applyAction(escalated, {
      accion: "resolver", session, comentario: "Confirmamos que el caso fue atendido correctamente.",
      ahora: "2026-10-26T10:02",
    });
    const closed = applyAction(resolved, {
      accion: "cerrar", session, calificacion: 5, ahora: "2026-10-26T10:03",
    });
    const actions = [
      null,
      { accion: "responder", fecha: reply.ahora, usuario: session.usuario,
        rol: session.rol, idEmpleado: session.idEmpleado, nombre: session.nombre,
        puesto: session.puesto },
      { ...reply, session: undefined, comentario: reply.comentario, fecha: reply.ahora,
        usuario: session.usuario, rol: session.rol, idEmpleado: session.idEmpleado,
        nombre: session.nombre, puesto: session.puesto },
      { accion: "escalar", comentario: "Escalamos el caso con gerencia.", fecha: "2026-10-26T10:01",
        usuario: session.usuario, rol: session.rol, idEmpleado: session.idEmpleado,
        nombre: session.nombre, puesto: session.puesto },
      { accion: "resolver", comentario: "Confirmamos que el caso fue atendido correctamente.",
        fecha: "2026-10-26T10:02", usuario: session.usuario, rol: session.rol,
        idEmpleado: session.idEmpleado, nombre: session.nombre, puesto: session.puesto },
      { accion: "cerrar", calificacion: 5, fecha: "2026-10-26T10:03",
        usuario: session.usuario, rol: session.rol, idEmpleado: session.idEmpleado,
        nombre: session.nombre, puesto: session.puesto },
    ];
    expect(replayActions(original, actions)).toEqual(closed);
    expect(original.estatus).toBe("abierta");
  });
});
