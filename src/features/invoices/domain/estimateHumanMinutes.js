import { MIN_DUPLICATE, MIN_OK, MIN_REVIEW } from "../../../config/constants.js";

/**
 * Estima los minutos humanos según el estado de cada factura.
 * @param {Object[]} facturas Facturas con estado.
 * @returns {{minutos: number, horas: number, desglose: Object}} Estimación y minutos por estado.
 */
export function estimateHumanMinutes(facturas = []) {
  const desglose = { Revisar: 0, OK: 0, Aprobada: 0, Duplicada: 0, Rechazada: 0 };
  for (const factura of facturas) {
    switch (factura?.estado) {
      case "Revisar":
        desglose.Revisar += MIN_REVIEW;
        break;
      case "OK":
        desglose.OK += MIN_OK;
        break;
      case "Aprobada":
        desglose.Aprobada += MIN_OK;
        break;
      case "Duplicada":
        desglose.Duplicada += MIN_DUPLICATE;
        break;
      case "Rechazada":
        break;
      default:
        break;
    }
  }
  const minutos = Object.values(desglose).reduce((total, minutosEstado) => total + minutosEstado, 0);
  return { minutos, horas: minutos / 60, desglose };
}
