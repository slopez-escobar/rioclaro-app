import { formatMXN } from "../../../shared/utils/format.js";

export default function ReconciliationBadge({
  reconciliacion,
  esUnaSucursal,
  textoUnaSucursal,
}) {
  if (esUnaSucursal) {
    return <p className="sales-reconcile sales-reconcile-single">{textoUnaSucursal || "Ventas de tu sucursal"}</p>;
  }
  if (reconciliacion?.sumaSucursalesIgualTotal) {
    return (
      <p className="sales-reconcile sales-reconcile-ok" role="status">
        <span aria-hidden="true">✓</span> Las 5 sucursales suman el total general
      </p>
    );
  }
  const differences = (reconciliacion?.diferencias || [])
    .filter((item) => Math.abs(item.diferencia) > 0.01);
  return (
    <div className="sales-reconcile sales-reconcile-error" role="alert">
      <strong>Las sucursales no coinciden con el total general.</strong>
      <ul>
        {differences.map((item) => (
          <li key={item.medida}>
            {item.medida}: {formatMXN(item.sumaSucursales)} frente a {formatMXN(item.total)}
            {" "}({formatMXN(item.diferencia)})
          </li>
        ))}
      </ul>
    </div>
  );
}
