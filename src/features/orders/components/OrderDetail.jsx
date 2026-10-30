import Dialog from "../../../shared/ui/Dialog.jsx";
import Tag from "../../../shared/ui/Tag.jsx";
import { formatDate, formatDateTime, formatMXN } from "../../../shared/utils/format.js";
import {
  getOrderStateVariant,
  getPaymentVariant,
} from "../domain/orderLabels.js";

function Address({ address }) {
  if (!address) return <p>No hay dirección de entrega registrada.</p>;
  return (
    <address>
      {[address.calle, address.numero, address.colonia, address.ciudad, address.estado, address.codigoPostal]
        .filter(Boolean)
        .join(", ")}
    </address>
  );
}

export default function OrderDetail({ order, onClose }) {
  return (
    <Dialog
      open={Boolean(order)}
      onClose={onClose}
      labelledBy="pedido-detail-title"
      className="pedido-dialog"
    >
      {order ? (
        <article className="pedido-detail">
          <header className="pedido-detail-header">
            <div>
              <p className="pedido-overline">Detalle de pedido</p>
              <h2 id="pedido-detail-title">{order.folio}</h2>
            </div>
            <button type="button" className="pedido-close" onClick={onClose} aria-label="Cerrar detalle">
              Cerrar
            </button>
          </header>
          <div className="pedido-status-line">
            <Tag variant={getOrderStateVariant(order.estado)}>{order.estadoLabel}</Tag>
            <span>Pedido {formatDateTime(order.fechaPedido)}</span>
          </div>

          <section aria-labelledby="pedido-information-title">
            <h3 id="pedido-information-title">Información del pedido</h3>
            <dl className="pedido-facts">
              <div><dt>Cliente</dt><dd>{order.clienteNombre || order.idCliente}</dd></div>
              <div><dt>Identificador del pedido</dt><dd>{order.idPedido}</dd></div>
              <div><dt>Sucursal de venta</dt><dd>{order.sucursalNombre}</dd></div>
              <div><dt>Sucursal que surte</dt><dd>{order.sucursalSurtidoNombre}</dd></div>
              <div><dt>Canal</dt><dd>{order.canal || "—"}</dd></div>
              <div><dt>Tipo de entrega</dt><dd>{order.tipoEntregaLabel}</dd></div>
              <div><dt>Entrega estimada</dt><dd>{formatDate(order.fechaEntregaEstimada)}</dd></div>
              <div><dt>Entrega real</dt><dd>{formatDateTime(order.fechaEntrega)}</dd></div>
              <div><dt>Condición de pago</dt><dd>{order.pago?.condicion || "—"}</dd></div>
              <div><dt>Método de pago</dt><dd>{order.pago?.metodo || "—"}</dd></div>
              <div>
                <dt>Pago</dt>
                <dd><Tag variant={getPaymentVariant(order.pago?.estatus)}>{order.pagoLabel}</Tag></dd>
              </div>
            </dl>
          </section>

          {order.direccionEntrega ? (
            <section aria-labelledby="pedido-address-title">
              <h3 id="pedido-address-title">Dirección de entrega</h3>
              <Address address={order.direccionEntrega} />
            </section>
          ) : order.sucursalRecoleccion ? (
            <section aria-labelledby="pedido-pickup-title">
              <h3 id="pedido-pickup-title">Sucursal de recolección</h3>
              <p>{order.sucursalRecoleccionNombre}</p>
            </section>
          ) : null}

          <section aria-labelledby="pedido-items-title">
            <h3 id="pedido-items-title">Artículos ({order.articulos?.length || 0})</h3>
            <div className="pedido-items-scroll" role="region" aria-label="Artículos del pedido" tabIndex={0}>
              <table className="pedido-items-table">
                <caption>Artículos y cargos del pedido</caption>
                <thead>
                  <tr>
                    <th scope="col">Producto</th>
                    <th scope="col">Cantidad</th>
                    <th scope="col">Precio unitario</th>
                    <th scope="col">Descuento</th>
                    <th scope="col">IVA</th>
                    <th scope="col">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.articulos || []).map((item) => (
                    <tr key={item.numeroLinea}>
                      <th scope="row">{item.descripcion}<small>{item.claveProducto}</small></th>
                      <td>{item.cantidad} {item.unidad}</td>
                      <td>{formatMXN(item.valorUnitario)}</td>
                      <td>{item.descuentoPorcentaje || 0}%</td>
                      <td>{formatMXN(item.iva?.importe)}</td>
                      <td>{formatMXN(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="pedido-totals" aria-label="Totales">
            <div><span>Subtotal de productos</span><strong>{formatMXN(order.resumen?.subtotalProductos)}</strong></div>
            <div><span>Envío</span><strong>{formatMXN(order.resumen?.costoEnvio)}</strong></div>
            <div><span>Base gravable</span><strong>{formatMXN(order.resumen?.iva?.baseGravable)}</strong></div>
            <div><span>IVA</span><strong>{formatMXN(order.resumen?.iva?.importe)}</strong></div>
            <div className="pedido-total-final"><span>Total</span><strong>{formatMXN(order.resumen?.total)}</strong></div>
          </section>

          {order.motivoCancelacion || order.motivoDevolucion || order.notas ? (
            <section aria-labelledby="pedido-notes-title">
              <h3 id="pedido-notes-title">Notas y motivos</h3>
              {order.motivoCancelacion ? <p><strong>Cancelación:</strong> {order.motivoCancelacion}</p> : null}
              {order.motivoDevolucion ? <p><strong>Devolución:</strong> {order.motivoDevolucion}</p> : null}
              {order.notas ? <p>{order.notas}</p> : null}
            </section>
          ) : null}

          <section aria-labelledby="pedido-history-title">
            <h3 id="pedido-history-title">Historial de estatus</h3>
            <ol className="pedido-history">
              {(order.estadoEvents || order.historialEstados || []).map((event, index) => (
                <li key={`${event.estado}-${index}`}>
                  <strong>{event.label || event.estado}</strong>
                  <time dateTime={event.fecha}>{formatDateTime(event.fecha)}</time>
                </li>
              ))}
            </ol>
          </section>
        </article>
      ) : null}
    </Dialog>
  );
}
