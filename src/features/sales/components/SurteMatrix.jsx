import { formatMXN } from "../../../shared/utils/format.js";

export default function SurteMatrix({
  matriz,
  sucursales,
  fueraDeSucursal,
  surtidasParaOtras,
  esUnaSucursal,
}) {
  if (esUnaSucursal) {
    return (
      <section className="sales-section">
        <h2>Lo que tu sucursal surtió para otras sucursales</h2>
        {surtidasParaOtras.pedidos ? (
          <>
            <p>{surtidasParaOtras.pedidos.toLocaleString("es-MX")} pedidos · {formatMXN(surtidasParaOtras.productos)} en productos sin IVA</p>
            <ul className="sales-branch-list">
              {Object.entries(surtidasParaOtras.porSucursal).map(([id, value]) => (
                <li key={id}>
                  {sucursales.find((branch) => branch.id === id)?.ciudad
                    || sucursales.find((branch) => branch.id === id)?.nombre
                    || id}:{" "}
                  {value.pedidos.toLocaleString("es-MX")} pedidos · {formatMXN(value.productos)}
                </li>
              ))}
            </ul>
          </>
        ) : <p>Tu sucursal no surtió ventas para otras sucursales en este periodo.</p>}
      </section>
    );
  }

  return (
    <section className="sales-section">
      <h2>Venta y surtido por sucursal</h2>
      <p className="sales-muted">Productos sin IVA: las filas son la sucursal de venta y las columnas la sucursal que surte.</p>
      <div className="sales-table-scroll" tabIndex="0" aria-label="Matriz desplazable de sucursal de venta y sucursal que surte">
        <table className="sales-table sales-matrix">
          <caption>Importe de productos cruzado por sucursal de venta y de surtido</caption>
          <thead>
            <tr>
              <th scope="col">Sucursal de venta</th>
              {sucursales.map((branch) => <th scope="col" key={branch.id}>{branch.ciudad || branch.nombre}</th>)}
              <th scope="col">Total de la venta</th>
            </tr>
          </thead>
          <tbody>
            {sucursales.map((saleBranch) => {
              const cells = sucursales.map((supplyBranch) =>
                matriz[saleBranch.id]?.[supplyBranch.id]?.productos || 0,
              );
              const rowTotal = cells.reduce((sum, value) => sum + value, 0);
              return (
                <tr key={saleBranch.id}>
                  <th scope="row">{saleBranch.ciudad || saleBranch.nombre}</th>
                  {cells.map((amount, index) => (
                    <td
                      className={index === sucursales.findIndex((branch) => branch.id === saleBranch.id) ? "sales-diagonal" : ""}
                      key={sucursales[index].id}
                    >
                      {formatMXN(amount)}
                    </td>
                  ))}
                  <td><strong>{formatMXN(rowTotal)}</strong></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="sales-cross-branch">
        {fueraDeSucursal.pedidos.toLocaleString("es-MX")} pedidos ({formatMXN(fueraDeSucursal.productos)})
        {" "}se vendieron en una sucursal y se surtieron desde otra.
      </p>
    </section>
  );
}
