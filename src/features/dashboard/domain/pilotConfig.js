/**
 * Compara el gasto real con los límites de crédito y alerta del piloto.
 */
export function buildBudgetStatus(presupuesto) {
  const gasto = presupuesto.gastoRealUSD;
  const gastado = typeof gasto === "number" && Number.isFinite(gasto) ? gasto : null;
  const credito = presupuesto.creditoUSD;
  const alerta = presupuesto.alertaUSD;

  if (gastado === null) {
    return {
      gastado: null,
      porcentajeDelCredito: null,
      porcentajeDeLaAlerta: null,
      estado: "sin_datos",
    };
  }

  const porcentaje = (amount) => (
    typeof amount === "number" && amount > 0
      ? Math.round((gastado / amount) * 10000) / 100
      : null
  );
  return {
    gastado,
    porcentajeDelCredito: porcentaje(credito),
    porcentajeDeLaAlerta: porcentaje(alerta),
    estado: gastado >= credito ? "excedido" : gastado >= alerta ? "alerta" : "dentro",
  };
}
