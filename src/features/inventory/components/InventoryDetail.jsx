import { Link } from "react-router-dom";
import Dialog from "../../../shared/ui/Dialog.jsx";
import Tag from "../../../shared/ui/Tag.jsx";
import { formatDate, formatMXN } from "../../../shared/utils/format.js";
import { ESTATUS_LABEL, ESTATUS_VARIANT } from "../domain/index.js";

export default function InventoryDetail({ producto, onClose }) {
  return (
    <Dialog
      open={Boolean(producto)}
      onClose={onClose}
      labelledBy="inventory-detail-title"
      className="inventory-dialog"
    >
      {producto ? (
        <article className="inventory-detail">
          <header className="inventory-detail-header">
            <div>
              <p>Detalle de existencias</p>
              <h2 id="inventory-detail-title">{producto.nombre}</h2>
              <span>{producto.claveProducto} · {producto.presentacion}</span>
            </div>
            <button type="button" className="inventory-close" onClick={onClose} aria-label="Cerrar detalle">
              Cerrar
            </button>
          </header>

          <dl className="inventory-product-facts">
            <div><dt>Categoría</dt><dd>{producto.categoria}</dd></div>
            <div><dt>Unidad de venta</dt><dd>{producto.unidadVenta}</dd></div>
            <div><dt>Precio de lista (sin IVA)</dt><dd>{formatMXN(producto.precioListaMXN)}</dd></div>
          </dl>

          <p className="inventory-formula">
            <strong>Disponible = existencia - comprometido.</strong> La existencia es lo que hay físicamente; el disponible descuenta las unidades comprometidas en pedidos por surtir (POL-12).
          </p>

          <div className="inventory-detail-table-scroll" role="region" aria-label="Detalle por sucursal" tabIndex={0}>
            <table className="inventory-detail-table">
              <caption>Registros de existencias dentro de tu alcance</caption>
              <thead>
                <tr>
                  <th scope="col">Sucursal</th>
                  <th scope="col">Existencia</th>
                  <th scope="col">Comprometido</th>
                  <th scope="col">Disponible</th>
                  <th scope="col">Estatus</th>
                  <th scope="col">Punto de reorden</th>
                  <th scope="col">Mínimo</th>
                  <th scope="col">Máximo</th>
                  <th scope="col">Ubicación</th>
                  <th scope="col">Último conteo</th>
                  <th scope="col">Última entrada</th>
                </tr>
              </thead>
              <tbody>
                {producto.registros.map((record) => {
                  const { variant, symbol } = ESTATUS_VARIANT[record.estatusStock];
                  return (
                    <tr key={record.idSucursal}>
                      <th scope="row">{record.sucursal}</th>
                      <td>{record.existencia}</td>
                      <td>{record.comprometido}</td>
                      <td className="inventory-available">{record.disponible}</td>
                      <td>
                        <Tag variant={variant}>
                          <span aria-hidden="true">{symbol} </span>{ESTATUS_LABEL[record.estatusStock]}
                        </Tag>
                      </td>
                      <td>{record.puntoReorden}</td>
                      <td>{record.existenciaMinima}</td>
                      <td>{record.existenciaMaxima}</td>
                      <td>{record.ubicacion || "—"}</td>
                      <td>{formatDate(record.ultimoConteo)}</td>
                      <td>{formatDate(record.ultimaEntrada)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Link
            className="inventory-catalog-link"
            to={`/catalogo?clave=${encodeURIComponent(producto.claveProducto)}`}
            onClick={onClose}
          >
            Ver cómo lo nombra cada sucursal
          </Link>
        </article>
      ) : null}
    </Dialog>
  );
}
