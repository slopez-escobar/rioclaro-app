import { formatSalesPeriod } from "../salesFormat.js";

export default function SalesControls({
  periodos,
  periodo,
  idSucursal,
  onChange,
  mostrarSucursal,
  sucursales,
}) {
  return (
    <div className="sales-controls" aria-label="Filtros del reporte">
      <label className="sales-control" htmlFor="sales-period">
        Periodo
        <select
          id="sales-period"
          value={periodo}
          onChange={(event) => onChange({ periodo: event.target.value, idSucursal })}
        >
          <option value="">Todo el periodo</option>
          {periodos.map((item) => (
            <option key={item} value={item}>{formatSalesPeriod(item)}</option>
          ))}
        </select>
      </label>
      {mostrarSucursal ? (
        <label className="sales-control" htmlFor="sales-branch">
          Sucursal
          <select
            id="sales-branch"
            value={idSucursal}
            onChange={(event) => onChange({ periodo, idSucursal: event.target.value })}
          >
            <option value="">Todas las sucursales</option>
            {sucursales.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.ciudad || branch.nombre}</option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}
