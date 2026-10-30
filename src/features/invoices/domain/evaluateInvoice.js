import { detectDuplicate, findRepeatedFolio } from "./detectDuplicate.js";
import { normalizeAmount } from "./normalize.js";
import { validateInvoice } from "./validateInvoice.js";

/**
 * Determina el estado de una factura respetando la prioridad de duplicados.
 * @param {Object} extraccion Campos extraídos con valor y confianza.
 * @param {{nombre: string, hash: string}} archivo Archivo recibido.
 * @param {Object} options Catálogo de proveedores y facturas existentes.
 * @returns {{estado: "OK"|"Revisar"|"Duplicada", motivos: string[], proveedorId: string|null, duplicadoDe: Object|null}} Evaluación de dominio.
 */
export function evaluateInvoice(extraccion, archivo, { proveedores = [], existentes = [] } = {}) {
  const validacion = validateInvoice(extraccion, { proveedores });
  const datosFactura = {
    hash: archivo?.hash,
    rfc: extraccion?.rfc,
    folio: extraccion?.folio,
    total: extraccion?.total,
  };
  const duplicado = detectDuplicate(datosFactura, existentes);

  if (duplicado.duplicada) {
    const motivo = duplicado.tipo === "hash"
      ? `Duplicada por archivo: mismo contenido (hash) que ${duplicado.de.archivo}`
      : `Duplicada por datos: mismo proveedor, folio y total que ${duplicado.de.archivo}`;
    return {
      estado: "Duplicada",
      motivos: [motivo],
      proveedorId: validacion.proveedorId,
      duplicadoDe: { ...duplicado.de, tipo: duplicado.tipo },
    };
  }

  const repetida = findRepeatedFolio(datosFactura, existentes);
  const motivos = [...validacion.motivos];
  if (repetida.repetido) {
    const folio = extraccion?.folio?.valor ?? extraccion?.folio ?? "";
    motivos.push(
      `Folio repetido con total distinto: ${folio} ya existe en la factura ${repetida.de.archivo} por $${normalizeAmount(repetida.de.total).toFixed(2)}`,
    );
  }

  return {
    estado: motivos.length === 0 ? "OK" : "Revisar",
    motivos,
    proveedorId: validacion.proveedorId,
    duplicadoDe: null,
  };
}
