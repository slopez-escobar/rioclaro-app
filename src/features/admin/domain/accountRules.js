import { can } from "../../auth/permissions.js";

/** Indica si el rol puede administrar cuentas. */
export function canManageAccounts(session) {
  return can(session?.rol, "usuarios_y_accesos", "desactivar");
}

/**
 * Evalúa si una sesión puede desactivar la cuenta indicada.
 * @param {Object} session Sesión que solicita el cambio.
 * @param {Object} cuenta Cuenta objetivo.
 * @param {Object} options Estado de cuentas desactivadas.
 */
export function canDisableAccount(session, cuenta, { desactivadas = {} } = {}) {
  if (!canManageAccounts(session)) {
    return { permitido: false, motivo: "No tienes permiso para administrar cuentas" };
  }
  if (session?.usuario === cuenta?.usuario) {
    return { permitido: false, motivo: "No puedes desactivar tu propia cuenta" };
  }
  const disabled = cuenta?.estado === "desactivada"
    || (desactivadas instanceof Map
      ? desactivadas.has(cuenta?.usuario)
      : Array.isArray(desactivadas)
        ? desactivadas.some((entry) => entry === cuenta?.usuario || entry?.usuario === cuenta?.usuario)
        : Boolean(desactivadas?.[cuenta?.usuario]));
  if (disabled) {
    return { permitido: false, motivo: "La cuenta ya está desactivada" };
  }
  return { permitido: true, motivo: "" };
}

/** Valida el comentario obligatorio al desactivar una cuenta. */
export function validateDisableComment(comment) {
  return String(comment ?? "").trim().length >= 5
    ? { valido: true, motivo: "" }
    : { valido: false, motivo: "El motivo es obligatorio (mínimo 5 caracteres)" };
}
