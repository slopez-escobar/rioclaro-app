import PanelBlock from "./PanelBlock.jsx";

const usd = new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD" });

export default function CostBlock({ block }) {
  const { presupuesto, estadoPresupuesto, servicios } = block.datos;
  const gasto = estadoPresupuesto.gastado;
  return (
    <PanelBlock title="Costo del piloto" block={block}>
      <dl className="panel-metrics panel-budget">
        <div><dt>Crédito del piloto</dt><dd>{usd.format(presupuesto.creditoUSD)}</dd></div>
        <div><dt>Alerta de gasto</dt><dd>{usd.format(presupuesto.alertaUSD)}</dd></div>
        <div>
          <dt>Gasto real</dt>
          <dd>{gasto === null
            ? "Por medir en Azure Cost Management (paso B7)"
            : usd.format(gasto)}</dd>
        </div>
        <div><dt>Estado</dt><dd>{estadoPresupuesto.estado === "sin_datos"
          ? "Por medir"
          : estadoPresupuesto.estado}</dd></div>
      </dl>
      <div className="panel-table-scroll" tabIndex="0"
        aria-label="Servicios Azure y costos estimados; desplázate horizontalmente para ver toda la tabla">
        <table className="panel-cost-table">
          <caption>Servicios del piloto y costo estimado</caption>
          <thead><tr><th scope="col">Servicio</th><th scope="col">Por qué se necesita</th><th scope="col">Costo estimado</th></tr></thead>
          <tbody>{servicios.map((service) => (
            <tr key={service.nombre}>
              <th scope="row">{service.nombre}</th>
              <td>{service.justificacion}</td>
              <td>{service.estimadoUSD === null ? "Por medir" : usd.format(service.estimadoUSD)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </PanelBlock>
  );
}
