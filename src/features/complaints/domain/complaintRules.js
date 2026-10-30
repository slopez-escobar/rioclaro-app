import { FIRST_RESPONSE_TARGET_MIN } from "../../../config/constants.js";
import { minutesBetween } from "../../../shared/utils/time.js";

const PRIORITY_ORDER = { alta: 0, media: 1, baja: 2 };
const STATUS_ORDER = { abierta: 0, en_atencion: 0, escalada: 0, resuelta: 1, cerrada: 2 };

/**
 * Determina la prioridad con base en el tamaño del cliente y el monto.
 * @param {{tamano?:string,monto?:number}} input Datos para calcular prioridad.
 * @returns {"alta"|"media"|"baja"} Prioridad de atención.
 */
export function priorityOf({ tamano, monto = 0 }) {
  if (tamano === "grande" || monto >= 15000) return "alta";
  if (tamano === "mediano" || monto >= 5000) return "media";
  return "baja";
}

/**
 * Evalúa el objetivo de primera respuesta de 15 minutos corridos.
 * @param {Object} queja Registro de queja.
 * @param {string} ahora Fecha local AAAA-MM-DDTHH:mm.
 * @returns {{estado:string,minutos:number}} Estado y minutos de respuesta o espera.
 */
export function evaluateFirstResponse(queja, ahora) {
  if (queja.fechaPrimeraRespuesta) {
    const minutos = queja.tiempoPrimeraRespuestaMin;
    return {
      estado: minutos <= FIRST_RESPONSE_TARGET_MIN ? "cumplida" : "incumplida",
      minutos,
    };
  }
  const minutos = minutesBetween(queja.fechaQueja, ahora);
  return {
    estado: minutos <= FIRST_RESPONSE_TARGET_MIN ? "en_tiempo" : "vencida",
    minutos,
  };
}

/**
 * Ordena por estado, prioridad y antigüedad sin modificar la lista original.
 * @param {Object[]} lista Quejas que se ordenarán.
 * @returns {Object[]} Nueva lista ordenada.
 */
export function sortComplaints(lista) {
  return [...lista].sort((a, b) =>
    (STATUS_ORDER[a.estatus] ?? 0) - (STATUS_ORDER[b.estatus] ?? 0)
    || PRIORITY_ORDER[a.prioridad] - PRIORITY_ORDER[b.prioridad]
    || String(a.fechaQueja).localeCompare(String(b.fechaQueja)),
  );
}
