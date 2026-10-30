import { formatMXN } from "../../../shared/utils/format.js";
import PanelBlock from "./PanelBlock.jsx";

export default function SalesBlock({ block, detailLinks }) {
  if (block?.estado !== "ok") {
    return <PanelBlock title="Ventas" block={block} detailLinks={detailLinks} />;
  }
  const data = block.datos;
  const isReconciled = data.esUnaSucursal || data.sumaSucursalesIgualTotal;
  return (
    <PanelBlock title="Ventas" block={block} detailLinks={detailLinks}>
      <dl className="panel-metrics">
        <div><dt>Ventas netas (sin IVA)</dt><dd>{formatMXN(data.ventasNetas)}</dd></div>
        <div><dt>Total con IVA</dt><dd>{formatMXN(data.totalConIva)}</dd></div>
        <div><dt>Devoluciones</dt><dd>{formatMXN(data.devoluciones)} <small>({data.pedidosDevueltos} pedidos)</small></dd></div>
        <div><dt>Cancelados</dt><dd>{formatMXN(data.cancelados)} <small>({data.pedidosCancelados} pedidos)</small></dd></div>
      </dl>
      <p className={isReconciled ? "panel-reconciled" : "panel-unreconciled"}
        role={isReconciled ? "status" : "alert"}>
        {data.esUnaSucursal
          ? "Ventas de tu sucursal"
          : data.sumaSucursalesIgualTotal
          ? "✓ Las 5 sucursales suman el total general"
          : "⚠ Las sucursales no coinciden con el total general"}
      </p>
      <ul className="panel-branch-bars">
        {data.porSucursal.map((branch) => (
          <li key={branch.id}>
            <span>{branch.nombre}</span>
            <span className="panel-bar-track" aria-hidden="true">
              <span className="panel-bar-fill" style={{ width: `${branch.porcentaje}%` }} />
            </span>
            <strong>{formatMXN(branch.ventasNetas)}</strong>
            <small>{branch.porcentaje}% · {branch.pedidos} pedidos</small>
          </li>
        ))}
      </ul>
    </PanelBlock>
  );
}
