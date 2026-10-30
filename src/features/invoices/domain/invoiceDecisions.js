import {
  DIRECTION_APPROVAL_THRESHOLD,
  MIN_COMMENT_REJECT,
  MIN_COMMENT_RELEASE,
} from "../../../config/constants.js";
import { can } from "../../auth/permissions.js";

const FINAL_STATES = new Set(["Aprobada", "Rechazada"]);
const ALLOWED_ACTIONS = new Set(["aprobar", "rechazar", "liberar"]);

/**
 * Devuelve los roles requeridos para aprobar una factura según su total.
 * @param {number} total Total de la factura en pesos.
 * @returns {string[]} Roles que deben aprobar.
 */
export function requiredApprovals(total) {
  return total <= DIRECTION_APPROVAL_THRESHOLD
    ? ["finanzas"]
    : ["finanzas", "direccion"];
}

/**
 * Calcula qué aprobaciones faltan, sin permitir que una persona cubra dos roles.
 * @param {Object} factura Factura con total y aprobaciones registradas.
 * @returns {string[]} Roles de aprobación pendientes.
 */
export function pendingApprovals(factura) {
  const total = typeof factura?.total === "number" ? factura.total : factura?.total?.valor;
  const required = requiredApprovals(total);
  const seenUsers = new Set();
  const approvals = (Array.isArray(factura?.aprobaciones) ? factura.aprobaciones : [])
    .filter((approval) => {
      if (!approval || typeof approval.usuario !== "string" || !approval.usuario) return false;
      if (seenUsers.has(approval.usuario)) return false;
      seenUsers.add(approval.usuario);
      return true;
    });

  if (required.length === 1) {
    const financeCovered = approvals.some(
      (approval) => approval.rol === "finanzas" || approval.rol === "direccion",
    );
    return financeCovered ? [] : ["finanzas"];
  }

  const directionApprovals = approvals.filter((approval) => approval.rol === "direccion");
  const financeApprovals = approvals.filter(
    (approval) => approval.rol === "finanzas" || approval.rol === "direccion",
  );
  if (directionApprovals.length === 0) {
    return financeApprovals.length > 0 ? ["direccion"] : ["finanzas", "direccion"];
  }
  const distinctApprovals = directionApprovals.some((directionApproval) =>
    financeApprovals.some((financeApproval) => financeApproval.usuario !== directionApproval.usuario),
  );
  return distinctApprovals ? [] : ["finanzas"];
}

/**
 * Comprueba si una persona puede realizar una decisión sobre la factura.
 * @param {Object} session Sesión activa.
 * @param {Object} factura Factura que se quiere decidir.
 * @param {"aprobar"|"rechazar"|"liberar"} accion Decisión solicitada.
 * @returns {{permitido: boolean, motivo: string|null}} Resultado de autorización.
 */
export function canDecide(session, factura, accion) {
  if (!can(session?.rol, "facturas_proveedores", "aprobar")) {
    return { permitido: false, motivo: "No tienes permiso para decidir sobre facturas" };
  }
  if (FINAL_STATES.has(factura?.estado)) {
    return { permitido: false, motivo: "La factura ya tiene una decisión final" };
  }
  if (!ALLOWED_ACTIONS.has(accion)) {
    return { permitido: false, motivo: "La acción de decisión no es válida" };
  }
  if (accion === "aprobar") {
    if (factura?.estado === "Duplicada") {
      return {
        permitido: false,
        motivo: "Una factura duplicada debe liberarse antes de aprobarla",
      };
    }
    if (
      typeof session?.usuario === "string"
      && factura?.aprobaciones?.some((approval) => approval?.usuario === session.usuario)
    ) {
      return { permitido: false, motivo: "Ya registraste tu aprobación" };
    }
  }
  if (accion === "liberar" && factura?.estado !== "Duplicada") {
    return { permitido: false, motivo: "Solo se puede liberar una factura duplicada" };
  }
  return { permitido: true, motivo: null };
}

/**
 * Aplica una decisión y devuelve una factura nueva con su historial actualizado.
 * @param {Object} factura Factura original.
 * @param {Object} options Decisión, sesión, comentario y fecha explícita.
 * @returns {Object} Factura actualizada sin mutar la original.
 */
export function applyDecision(factura, { accion, session, comentario, ahora }) {
  const authorization = canDecide(session, factura, accion);
  if (!authorization.permitido) throw new Error(authorization.motivo);

  const comment = typeof comentario === "string" ? comentario.trim() : "";
  const requiredCommentLength = accion === "liberar"
    ? MIN_COMMENT_RELEASE
    : accion === "rechazar" || (accion === "aprobar" && factura.estado === "Revisar")
      ? MIN_COMMENT_REJECT
      : 0;
  if (comment.length < requiredCommentLength) {
    throw new Error(
      `El comentario es obligatorio (mínimo ${requiredCommentLength} caracteres)`,
    );
  }

  const historyEntry = {
    fecha: ahora,
    accion,
    usuario: session.usuario,
    rol: session.rol,
    nombre: session.nombre,
    comentario: comment || null,
  };
  const updated = {
    ...factura,
    historial: [...(Array.isArray(factura.historial) ? factura.historial : []), historyEntry],
  };

  if (accion === "aprobar") {
    updated.aprobaciones = [
      ...(Array.isArray(factura.aprobaciones) ? factura.aprobaciones : []),
      { rol: session.rol, usuario: session.usuario, nombre: session.nombre, fecha: ahora },
    ];
    if (pendingApprovals(updated).length === 0) {
      updated.estado = "Aprobada";
      updated.decididaPor = session.usuario;
      updated.decididaEn = ahora;
    }
  } else if (accion === "rechazar") {
    updated.estado = "Rechazada";
    updated.decididaPor = session.usuario;
    updated.decididaEn = ahora;
  } else {
    updated.estado = "Revisar";
    updated.motivos = [
      ...(Array.isArray(factura.motivos) ? factura.motivos : []),
      `Liberada como no duplicada por ${session.nombre}: ${comment}`,
    ];
  }

  return updated;
}
