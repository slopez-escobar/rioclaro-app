import { toCents } from "./salesRules.js";

const MEASURES = ["pedidos", "productos", "envio", "iva", "total"];

/** Comprueba que los desgloses por sucursal sumen el total neto del reporte. */
export function reconcileReport(reporte) {
  const sucursales = Object.values(reporte.porSucursal || {});
  const total = reporte.totales?.netas || {};
  const diferencias = MEASURES.map((medida) => {
    const sumaCents = sucursales.reduce(
      (sum, sucursal) => sum + toCents(sucursal[medida]),
      0,
    );
    const totalCents = toCents(total[medida]);
    return {
      medida,
      sumaSucursales: sumaCents / 100,
      total: totalCents / 100,
      diferencia: (sumaCents - totalCents) / 100,
    };
  });
  return {
    sumaSucursalesIgualTotal: diferencias.every(
      (item) => Math.abs(item.diferencia) <= 0.01,
    ),
    diferencias,
  };
}
