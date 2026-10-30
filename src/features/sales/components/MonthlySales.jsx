import { formatMXN } from "../../../shared/utils/format.js";
import { formatSalesPeriod, salesPercentage } from "../salesFormat.js";

export default function MonthlySales({ porMes }) {
  const rows = Object.entries(porMes)
    .map(([periodo, value]) => ({ periodo, ...value }))
    .sort((left, right) => left.periodo.localeCompare(right.periodo));
  const maximum = Math.max(0, ...rows.map((row) => row.productos));

  return (
    <section className="sales-section">
      <h2>Ventas por mes</h2>
      <div className="sales-table-scroll" tabIndex="0" aria-label="Tabla desplazable de ventas mensuales">
        <table className="sales-table">
          <caption>Importes por mes de la fecha del pedido</caption>
          <thead>
            <tr>
              <th scope="col">Mes</th>
              <th scope="col">Pedidos</th>
              <th scope="col">Productos (sin IVA)</th>
              <th scope="col">Total con IVA</th>
              <th scope="col">Comparación</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.periodo}>
                <th scope="row">{formatSalesPeriod(row.periodo)}</th>
                <td>{row.pedidos.toLocaleString("es-MX")}</td>
                <td>{formatMXN(row.productos)}</td>
                <td>{formatMXN(row.total)}</td>
                <td>
                  <span className="sales-month-track" aria-hidden="true">
                    <span style={{ width: `${salesPercentage(row.productos, maximum)}%` }} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sales-muted">
        Datos de ejemplo: las ventas de septiembre y octubre de 2026 son mayores porque los pedidos recientes se concentran en los últimos 45 días.
      </p>
    </section>
  );
}
