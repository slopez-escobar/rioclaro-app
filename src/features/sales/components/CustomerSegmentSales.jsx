import { formatMXN } from "../../../shared/utils/format.js";

const TYPE_LABELS = {
  hotel: "Hotel",
  restaurante: "Restaurante",
  escuela: "Escuela",
  tienda: "Tienda",
};
const SIZE_LABELS = {
  grande: "Grande",
  mediano: "Mediano",
  pequeño: "Pequeño",
};

function SegmentTable({ title, values, labels }) {
  return (
    <div className="sales-segment">
      <h3>{title}</h3>
      <div className="sales-table-scroll" tabIndex="0" aria-label={`Tabla desplazable: ${title}`}>
        <table className="sales-table">
          <caption>Ventas netas por segmento de clientes</caption>
          <thead>
            <tr>
              <th scope="col">Segmento</th>
              <th scope="col">Pedidos</th>
              <th scope="col">Productos (sin IVA)</th>
              <th scope="col">Total con IVA</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(values).map(([key, value]) => (
              <tr key={key}>
                <th scope="row">{labels[key] || key}</th>
                <td>{value.pedidos.toLocaleString("es-MX")}</td>
                <td>{formatMXN(value.productos)}</td>
                <td>{formatMXN(value.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CustomerSegmentSales({ porTipoCliente, porTamano }) {
  return (
    <section className="sales-section">
      <h2>Ventas por segmento de cliente</h2>
      {porTipoCliente === null || porTamano === null ? (
        <p className="sales-muted">Tu rol no tiene acceso a la información de clientes.</p>
      ) : (
        <div className="sales-segments">
          <SegmentTable title="Tipo de cliente" values={porTipoCliente} labels={TYPE_LABELS} />
          <SegmentTable title="Tamaño" values={porTamano} labels={SIZE_LABELS} />
        </div>
      )}
    </section>
  );
}
