export function ok(body, headers) {
  return { status: 200, jsonBody: body, ...(headers ? { headers } : {}) };
}

export function fail(status, mensaje, extra = {}) {
  return { status, jsonBody: { error: mensaje, ...extra } };
}

export async function parseJsonBody(
  request,
  {
    maxBytes = 1024 * 1024,
    tooLargeMessage = "El archivo supera el tamaño permitido",
  } = {},
) {
  let body;
  try {
    body = await request.json();
  } catch {
    return { response: fail(400, "Solicitud inválida") };
  }

  let serialized;
  try {
    serialized = JSON.stringify(body);
  } catch {
    return { response: fail(400, "Solicitud inválida") };
  }
  if (typeof serialized !== "string") return { response: fail(400, "Solicitud inválida") };
  if (Buffer.byteLength(serialized, "utf8") > maxBytes) {
    return { response: fail(413, tooLargeMessage) };
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { response: fail(400, "Solicitud inválida") };
  }
  return { body };
}

export function errorToResponse(_error) {
  return fail(500, "Error interno");
}
