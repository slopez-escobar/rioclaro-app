import { formatDateTime, formatMXN } from "../../../shared/utils/format.js";
import Tag from "../../../shared/ui/Tag.jsx";
import { getOrderStateVariant, getPaymentVariant } from "../domain/orderLabels.js";

export default function OrdersTable({ orders, onSelect, selectedId }) {
  if (!orders.length) {
    return <p className="pedidos-empty">No hay pedidos con estos filtros.</p>;
  }

  return (
    <div className="pedidos-table-scroll" role="region" aria-label="Resultados de pedidos" tabIndex={0}>
      <table className="pedidos-table">
        <caption>Pedidos visibles según tu permiso y alcance</caption>
        <thead>
          <tr>
            <th scope="col">Folio</th>
            <th scope="col">Fecha</th>
            <th scope="col">Cliente</th>
            <th scope="col">Sucursal</th>
            <th scope="col">Estatus</th>
            <th scope="col">Entrega</th>
            <th scope="col">Pago</th>
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr
              key={order.idPedido}
              className="pedidos-row"
              tabIndex={0}
              aria-selected={selectedId === order.idPedido}
              onClick={() => onSelect(order.idPedido)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(order.idPedido);
                }
              }}
            >
              <th scope="row">{order.folio}</th>
              <td>{formatDateTime(order.fechaPedido)}</td>
              <td>{order.clienteNombre || order.idCliente}</td>
              <td>
                {order.sucursalNombre}
                {order.idSucursalSurtido !== order.idSucursal
                  ? <small className="pedidos-other-branch">Surtido en {order.sucursalSurtidoNombre}</small>
                  : null}
              </td>
              <td><Tag variant={getOrderStateVariant(order.estado)}>{order.estadoLabel}</Tag></td>
              <td>{order.tipoEntregaLabel}</td>
              <td><Tag variant={getPaymentVariant(order.pago?.estatus)}>{order.pagoLabel}</Tag></td>
              <td className="pedidos-money">{formatMXN(order.resumen?.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
