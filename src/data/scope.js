const ALCANCES_VALIDOS = new Set(["todas", "sucursal", "propio"]);

/**
 * Obtiene el alcance y las identificaciones de sucursal y cliente de la sesión.
 */
export function getScope(session) {
  if (!ALCANCES_VALIDOS.has(session?.alcance)) {
    throw new Error("Sesión sin alcance válido");
  }
  return {
    alcance: session.alcance,
    idSucursal: session.idSucursal,
    idCliente: session.idCliente,
  };
}

/**
 * Indica si el alcance de la sesión permite ver al cliente.
 */
export function canSeeCliente(session, cliente) {
  const scope = getScope(session);
  if (scope.alcance === "todas") return true;
  if (scope.alcance === "sucursal") return cliente.idSucursal === scope.idSucursal;
  return cliente.idCliente === session.idCliente;
}

/**
 * Indica si el alcance de la sesión permite ver el pedido.
 */
export function canSeePedido(session, pedido) {
  const scope = getScope(session);
  if (scope.alcance === "todas") return true;
  if (scope.alcance === "sucursal") {
    return pedido.idSucursal === scope.idSucursal
      || pedido.idSucursalSurtido === scope.idSucursal;
  }
  return pedido.idCliente === session.idCliente;
}

/**
 * Indica si el alcance de la sesión permite ver la existencia.
 */
export function canSeeExistencia(session, existencia) {
  const scope = getScope(session);
  if (scope.alcance === "todas") return true;
  if (scope.alcance === "sucursal") return existencia.idSucursal === scope.idSucursal;
  return false;
}

/**
 * Indica si el alcance de la sesión permite ver la queja.
 */
export function canSeeQueja(session, queja) {
  const scope = getScope(session);
  if (scope.alcance === "todas") return true;
  if (scope.alcance === "sucursal") {
    return queja.idSucursal === scope.idSucursal
      || queja.idSucursalSurtido === scope.idSucursal;
  }
  return queja.idCliente === session.idCliente;
}
