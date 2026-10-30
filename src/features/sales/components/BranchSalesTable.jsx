import { formatMXN } from "../../../shared/utils/format.js";
import { salesPercentage } from "../salesFormat.js";

const MONEY_FIELDS = [
  ["Productos (sin IVA)", "productos"],
  ["Envío", "envio"],
  ["IVA", "iva"],
  ["Total", "total"],
];

export default function BranchSalesTable({ porSucursal, sucursales, totalGeneral }) {
  const rows = Object.entries(porSucursal).map(([id, values]) => ({
    id,
    nombre: sucursales.find((branch) => branch.id === id)?.ciudad
      || sucursales.find((branch) => branch.id === id)?.nombre
      || id,
    ...values,
  }));
  const total = rows.reduce((sum, row) => ({
    pedidos: sum.pedidos + row.pedidos,
    productos: sum.productos + row.productos,
    envio: sum.envio + row.envio,
    iva: sum.iva + row.iva,
    total: sum.total + row.total,
  }), { pedidos: 0, productos: 0, envio: 0, iva: 0, total: 0 });
  const maximum = Math.max(0, ...rows.map((row) => row.productos));

  return (
    <section className="sales-section">
      <h2>Ventas por sucursal (venta)</h2>
      <div className="sales-table-scroll" tabIndex="0" aria-label="Tabla desplazable de ventas por sucursal">
        <table className="sales-table">
          <caption>Importes netos por sucursal del cliente, sin excluir pedidos en curso</caption>
          <thead>
            <tr>
              <th scope="col">Sucursal</th>
              <th scope="col">Pedidos</th>
              {MONEY_FIELDS.map(([label]) => <th scope="col" key={label}>{label}</th>)}
              <th scope="col">% del total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <th scope="row">{row.nombre}</th>
                <td>{row.pedidos.toLocaleString("es-MX")}</td>
                {MONEY_FIELDS.map(([, field]) => (
                  <td key={field}>{formatMXN(row[field])}</td>
                ))}
                <td>
                  <div className="sales-share">
                    <span>{salesPercentage(row.productos, totalGeneral).toFixed(1)}%</span>
                    <span
                      className="sales-share-track"
                      role="img"
                      aria-label={`${salesPercentage(row.productos, totalGeneral).toFixed(1)} por ciento`}
                    >
                      <span style={{ width: `${salesPercentage(row.productos, maximum)}%` }} />
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">TOTAL</th>
              <td>{total.pedidos.toLocaleString("es-MX")}</td>
              {MONEY_FIELDS.map(([, field]) => (
                <td key={field}>{formatMXN(total[field])}</td>
              ))}
              <td>
                {formatMXN(total.productos)} frente a {formatMXN(totalGeneral)}
                {Math.abs(total.productos - totalGeneral) <= 0.01 ? " · Coincide" : " · Diferencia"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
