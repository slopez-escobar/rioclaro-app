const PAYMENT_LABELS = {
  pagado: "Pagado",
  pendiente: "Pendiente",
  vencido: "Vencido",
  no_aplica: "No aplica",
  nota_de_credito: "Nota de crédito",
};

const DELIVERY_LABELS = {
  envio_a_domicilio: "Envío a domicilio",
  recoger_en_sucursal: "Recoger en sucursal",
};

const IN_PROGRESS_STATES = new Set([
  "pendiente_confirmacion",
  "aceptado",
  "en_preparacion",
  "listo_para_recoger",
  "en_ruta",
]);

/**
 * Usa la descripción del catálogo que también consulta el asistente.
 */
export function getOrderStateLabel(estado, estadosPedido = []) {
  return estadosPedido.find((item) => item.codigo === estado)?.descripcion
    || String(estado ?? "").replaceAll("_", " ")
    || "Sin estado";
}

export function isOrderInProgress(estado) {
  return IN_PROGRESS_STATES.has(estado);
}

export function getPaymentLabel(estatus) {
  return PAYMENT_LABELS[estatus] || estatus || "Sin dato";
}

export function getDeliveryLabel(tipoEntrega) {
  return DELIVERY_LABELS[tipoEntrega] || tipoEntrega || "Sin dato";
}

export function getOrderStateVariant(estado) {
  if (estado === "entregado") return "ok";
  if (estado === "cancelado" || estado === "devuelto") return "revisar";
  return "info";
}

export function getPaymentVariant(estatus) {
  if (estatus === "pagado" || estatus === "no_aplica") return "ok";
  if (estatus === "vencido" || estatus === "nota_de_credito") return "revisar";
  return "info";
}
