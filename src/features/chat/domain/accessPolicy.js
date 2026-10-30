/**
 * Selecciona las políticas que la sesión puede consultar.
 * @param {Object|null} session Sesión activa.
 * @param {Object[]} politicas Políticas vigentes.
 * @returns {Object[]} Políticas autorizadas.
 */
export function policiesAllowed(session, politicas) {
  if (!session) throw new Error("Sesión requerida");
  if (session.rol !== "cliente") return politicas.filter((policy) => policy.vigente);
  return politicas.filter((policy) =>
    policy.vigente
    && policy.audiencia === "publica"
    && policy.cargarEnAsistenteClientes === true,
  );
}

/**
 * Selecciona fragmentos solo de las políticas autorizadas para la sesión.
 * @param {Object|null} session Sesión activa.
 * @param {Object[]} fragmentos Fragmentos indexados.
 * @param {Object[]} politicas Políticas vigentes.
 * @returns {Object[]} Fragmentos autorizados.
 */
export function fragmentsAllowed(session, fragmentos, politicas) {
  const allowedIds = new Set(policiesAllowed(session, politicas).map((policy) => policy.id));
  return fragmentos.filter((fragment) => allowedIds.has(fragment.polId));
}
