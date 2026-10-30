import { priorityOf } from "./complaintRules.js";

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX");
}

function inferTopic(description) {
  const text = normalizeText(description);
  if (/\b(existencia|agotad[oa]s?)\b/.test(text)) return "sin_existencia";
  if (/\b(error|equivocad[oa]s?|captura)\b/.test(text)) return "error_de_captura";
  if (/\bno llego\b|\brepartidor\b|\blocalizaron\b/.test(text)) return "entrega_fallida";
  if (/\b(cobro|doble|duplicad[oa]s?)\b/.test(text)) return "cobro_duplicado";
  if (/\bcancel/.test(text)) return "cancelacion_solicitada";
  return "sin_clasificar";
}

/**
 * Construye un registro de queja compatible con el catálogo de datos.
 * @param {Object} input Sesión, cliente, pedido y datos para el registro.
 * @returns {Object} Queja lista para persistirse.
 */
export function buildComplaint({
  session,
  cliente,
  pedido = null,
  descripcion,
  numero,
  ahora,
}) {
  const timestamp = String(ahora);
  const [date, time = "00:00"] = timestamp.split("T");
  const year = date.slice(0, 4);
  const amount = Number(pedido?.resumen?.total ?? pedido?.total ?? 0);
  const customerSize = cliente?.tamano;
  const priority = priorityOf({ tamano: customerSize, monto: amount });
  const serial = String(numero).padStart(4, "0");

  return {
    idQueja: `QJA-${serial}`,
    folio: `QJ-${year}-${serial}`,
    fechaQueja: `${date}T${time.slice(0, 5)}`,
    idCliente: cliente.idCliente,
    idPedido: pedido?.idPedido || null,
    folioPedido: pedido?.folio || null,
    idSucursal: cliente.idSucursal,
    idSucursalSurtido: pedido?.idSucursalSurtido || null,
    surtidoEnOtraSucursal: Boolean(
      pedido?.idSucursalSurtido
      && pedido.idSucursalSurtido !== cliente.idSucursal,
    ),
    canal: "asistente",
    tema: inferTopic(descripcion),
    motivoCancelacionPedido: pedido?.motivoCancelacion || null,
    descripcion: String(descripcion).trim(),
    montoPedidoMXN: amount,
    prioridad: priority,
    casoRepetido: false,
    quejasRelacionadas: [],
    estatus: "abierta",
    idEmpleadoAsignado: null,
    respuestas: [],
    fechaPrimeraRespuesta: null,
    tiempoPrimeraRespuestaMin: null,
    cumpleObjetivo15min: null,
    fechaResolucion: null,
    calificacionCliente: null,
  };
}
