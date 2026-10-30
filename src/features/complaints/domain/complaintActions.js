import {
  MIN_COMMENT_ESCALATE,
  MIN_COMMENT_REPLY,
  MIN_COMMENT_RESOLVE,
} from "../../../config/constants.js";
import { can } from "../../auth/permissions.js";
import { minutesBetween } from "../../../shared/utils/time.js";

const ACTIONS = new Set(["responder", "escalar", "resolver", "cerrar"]);
const COMMENT_MINIMUMS = {
  responder: MIN_COMMENT_REPLY,
  escalar: MIN_COMMENT_ESCALATE,
  resolver: MIN_COMMENT_RESOLVE,
};

function hasHumanResponse(queja) {
  return queja.respuestas?.some((respuesta) => respuesta.autor?.tipo === "empleado");
}

/**
 * Autoriza atención por rol o por los puestos operativos autorizados.
 * La excepción por puesto permite atender las quejas históricas creadas por Atención a clientes.
 * @param {Object} session Sesión activa.
 * @returns {boolean} Si puede atender quejas.
 */
export function canAttend(session) {
  return Boolean(
    can(session?.rol, "quejas", "atender")
    || session?.puesto === "Atención a clientes"
    || session?.puesto === "Supervisor de ventas",
  );
}

/**
 * Valida si una sesión puede aplicar una acción a una queja.
 * @param {Object} session Sesión activa.
 * @param {Object} queja Queja objetivo.
 * @param {string} accion Acción solicitada.
 * @returns {{permitido:boolean,motivo:string|null}} Resultado y razón del rechazo.
 */
export function canAct(session, queja, accion) {
  const deny = (motivo) => ({ permitido: false, motivo });
  if (!canAttend(session)) return deny("Tu rol no puede atender quejas");
  if (queja.estatus === "cerrada") return deny("La queja ya está cerrada");

  if (accion === "responder") {
    if (queja.estatus === "resuelta") return deny("La queja ya tiene una respuesta final");
    if (["abierta", "en_atencion", "escalada"].includes(queja.estatus)) {
      return { permitido: true, motivo: null };
    }
    return deny("No se puede responder una queja en este estatus");
  }
  if (accion === "escalar") {
    if (queja.estatus === "escalada") return deny("La queja ya está escalada");
    if (["abierta", "en_atencion"].includes(queja.estatus)) {
      return { permitido: true, motivo: null };
    }
    return deny("Solo se puede escalar una queja abierta o en atención");
  }
  if (accion === "resolver") {
    if (!hasHumanResponse(queja)) return deny("Primero responde al cliente");
    if (queja.estatus === "escalada"
      && (session?.puesto === "Atención a clientes"
        || !can(session?.rol, "quejas", "atender"))) {
      return deny("Una queja escalada solo la resuelve la gerencia");
    }
    if (["abierta", "en_atencion", "escalada"].includes(queja.estatus)) {
      return { permitido: true, motivo: null };
    }
    return deny("Solo se puede resolver una queja abierta, en atención o escalada");
  }
  if (accion === "cerrar") {
    return queja.estatus === "resuelta"
      ? { permitido: true, motivo: null }
      : deny("Solo se puede cerrar una queja resuelta");
  }
  return deny("La acción no es válida");
}

function validateComment(comentario, minimum) {
  if (String(comentario ?? "").trim().length < minimum) {
    throw new Error(`El comentario es obligatorio (mínimo ${minimum} caracteres)`);
  }
}

/**
 * Aplica una acción autorizada y devuelve una queja nueva, sin mutar el registro original.
 * @param {Object} queja Queja de entrada.
 * @param {Object} input Acción y datos de auditoría.
 * @returns {Object} Queja actualizada.
 */
export function applyAction(queja, {
  accion,
  session,
  comentario,
  calificacion,
  ahora,
}) {
  const decision = canAct(session, queja, accion);
  if (!decision.permitido) throw new Error(decision.motivo);

  if (!ACTIONS.has(accion)) throw new Error("La acción no es válida");
  if (accion === "cerrar") {
    if (!Number.isInteger(calificacion) || calificacion < 1 || calificacion > 5) {
      throw new Error("La calificación debe ser de 1 a 5");
    }
  } else {
    validateComment(comentario, COMMENT_MINIMUMS[accion]);
  }

  const updated = structuredClone(queja);
  let tipo;
  if (accion === "responder") {
    const firstResponse = !updated.fechaPrimeraRespuesta;
    tipo = firstResponse ? "acuse" : "seguimiento";
    if (firstResponse) {
      updated.fechaPrimeraRespuesta = ahora;
      updated.tiempoPrimeraRespuestaMin = minutesBetween(updated.fechaQueja, ahora);
      updated.cumpleObjetivo15min = updated.tiempoPrimeraRespuestaMin <= 15;
    }
    if (updated.estatus === "abierta") updated.estatus = "en_atencion";
    if (updated.idEmpleadoAsignado == null) updated.idEmpleadoAsignado = session.idEmpleado;
  } else if (accion === "escalar") {
    updated.estatus = "escalada";
    tipo = "escalamiento";
  } else if (accion === "resolver") {
    updated.estatus = "resuelta";
    updated.fechaResolucion = ahora;
    tipo = "resolucion";
  } else {
    updated.estatus = "cerrada";
    updated.calificacionCliente = calificacion;
    tipo = "cierre";
  }

  updated.respuestas = [...(updated.respuestas || []), {
    fecha: ahora,
    tipo,
    autor: accion === "cerrar"
      ? { tipo: "cliente", id: updated.idCliente, nombre: "Cliente" }
      : {
        tipo: "empleado",
        id: session.idEmpleado,
        nombre: session.nombre,
        puesto: session.puesto,
      },
    comentario: accion === "cerrar"
      ? String(comentario ?? "").trim() || "El cliente confirmó la solución."
      : String(comentario).trim(),
  }];
  return updated;
}

/**
 * Reproduce acciones persistidas en orden, ignorando las que no sean aplicables.
 * @param {Object} queja Registro de solo lectura inicial.
 * @param {Object[]} acciones Acciones almacenadas cronológicamente.
 * @returns {Object} Estado derivado de la queja.
 */
export function replayActions(queja, acciones) {
  let current = queja;
  for (const action of Array.isArray(acciones) ? acciones : []) {
    if (!action || typeof action !== "object") continue;
    const session = {
      usuario: action.usuario,
      rol: action.rol,
      idEmpleado: action.idEmpleado,
      nombre: action.nombre,
      puesto: action.puesto,
    };
    const decision = canAct(session, current, action.accion);
    if (!decision.permitido) continue;
    try {
      current = applyAction(current, {
        accion: action.accion,
        session,
        comentario: action.comentario,
        calificacion: action.calificacion,
        ahora: action.fecha,
      });
    } catch (error) {
      if (error instanceof Error && (
        /^El comentario es obligatorio/.test(error.message)
        || error.message === "La calificación debe ser de 1 a 5"
        || error.message === "La fecha debe tener el formato AAAA-MM-DDTHH:mm"
      )) continue;
      throw error;
    }
  }
  return current;
}
