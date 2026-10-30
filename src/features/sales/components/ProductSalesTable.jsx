import { useState } from "react";
import Button from "../../../shared/ui/Button.jsx";
import { formatMXN } from "../../../shared/utils/format.js";

const INITIAL_COUNT = 10;

export default function ProductSalesTable({ porProducto }) {
  const [showAll, setShowAll] = useState(false);
  const rows = Object.entries(porProducto)
    .map(([clave, product]) => ({ clave, ...product }))
    .sort((left, right) => right.importe - left.importe || left.clave.localeCompare(right.clave));
  const visible = showAll ? rows : rows.slice(0, INITIAL_COUNT);

  return (
    <section className="sales-section">
      <h2>Ventas por producto</h2>
      <div className="sales-table-scroll" tabIndex="0" aria-label="Tabla desplazable de ventas por producto">
        <table className="sales-table">
          <caption>Nombre único del catálogo; importes de productos netos, sin pedidos cancelados ni devueltos</caption>
          <thead>
            <tr>
              <th scope="col">Producto</th>
              <th scope="col">Clave</th>
              <th scope="col">Unidades</th>
              <th scope="col">Importe</th>
              <th scope="col">IVA</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.clave}>
                <th scope="row">{row.nombre}</th>
                <td>{row.clave}</td>
                <td>{row.unidades.toLocaleString("es-MX")}</td>
                <td>{formatMXN(row.importe)}</td>
                <td>{formatMXN(row.iva)}</td>
                <td>{formatMXN(row.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > INITIAL_COUNT ? (
        <Button
          variant="secondary"
          aria-expanded={showAll}
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll ? "Mostrar solo los 10 primeros" : `Ver los ${rows.length} productos`}
        </Button>
      ) : null}
    </section>
  );
}
