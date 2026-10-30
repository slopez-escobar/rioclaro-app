/**
 * Interfaz reservada al proveedor de Azure para el paso B3.
 * @param {Object} request Mensaje, sesión e historial.
 * @returns {Promise<Object>} Respuesta del proveedor.
 */
export async function send({ texto, message, session, historial = [] } = {}) {
  void texto;
  void message;
  void session;
  void historial;
  throw new Error("Proveedor de Azure no implementado (paso B3)");
}

export const azureChatProvider = { send, sendMessage: send, respond: send };
