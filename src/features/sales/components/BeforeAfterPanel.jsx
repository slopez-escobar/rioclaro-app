import { formatMXN } from "../../../shared/utils/format.js";
import { formatReconciliationBreakdown } from "../salesFormat.js";
import ReconciliationBadge from "./ReconciliationBadge.jsx";

function Difference({ amount }) {
  const positive = amount >= 0;
  return (
    <span className={positive ? "sales-difference sales-difference-up" : "sales-difference sales-difference-down"}>
      <span aria-hidden="true">{positive ? "▲" : "▼"}</span>
      {" "}{positive ? "+" : "−"}{formatMXN(Math.abs(amount))}
    </span>
  );
}

export default function BeforeAfterPanel({ conciliacion, esUnaSucursal }) {
  const branches = conciliacion?.sucursales || [];
  const totalReported = branches.reduce((sum, branch) => sum + branch.totalReportado, 0);
  const totalCorrect = branches.reduce((sum, branch) => sum + branch.totalCorrecto, 0);
  const totalDifference = totalReported - totalCorrect;

  return (
    <section className="sales-section sales-before-after">
      <h2>Antes y después: septiembre 2026</h2>
      <div className="sales-table-scroll" tabIndex="0" aria-label="Tabla desplazable de conciliación de reportes de sucursales">
        <table className="sales-table">
          <caption>Comparación de lo reportado en Excel con la definición única de ventas</caption>
          <thead>
            <tr>
              <th scope="col">Sucursal</th>
              <th scope="col">Reportó (archivo)</th>
              <th scope="col">Cifra correcta</th>
              <th scope="col">Diferencia</th>
              <th scope="col">Causa y desglose</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((branch) => (
              <tr key={branch.id}>
                <th scope="row">{branch.nombre}</th>
                <td>
                  {formatMXN(branch.totalReportado)}
                  <small className="sales-file-name">{branch.archivo}</small>
                </td>
                <td>{formatMXN(branch.totalCorrecto)}</td>
                <td><Difference amount={branch.diferencia} /></td>
                <td>
                  {branch.explicacion.descripcion}
                  <small>{formatReconciliationBreakdown(
                    branch.explicacion.hipotesis,
                    branch.explicacion.desglose,
                  )}</small>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">TOTAL</th>
              <td>{formatMXN(totalReported)}</td>
              <td>{formatMXN(totalCorrect)}</td>
              <td><Difference amount={totalDifference} /></td>
              <td>{esUnaSucursal ? "Diferencia de la sucursal" : "Diferencia global de los cinco reportes"}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="sales-before-after-note">
        {esUnaSucursal
          ? "La cifra correcta de tu sucursal se calcula con la misma definición que el consolidado."
          : "Con una sola definición de venta, las 5 sucursales suman exactamente el total consolidado."}
      </p>
      <ReconciliationBadge
        reconciliacion={{
          sumaSucursalesIgualTotal: branches.length === 5
            && Math.abs(totalCorrect - (conciliacion?.resumen?.totalCorrecto ?? Number.NaN)) <= 0.01,
          diferencias: [],
        }}
        esUnaSucursal={esUnaSucursal}
      />
    </section>
  );
}
