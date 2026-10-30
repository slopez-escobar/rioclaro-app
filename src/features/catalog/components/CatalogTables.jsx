import { formatMXN } from "../../../shared/utils/format.js";

function showValue(value) {
  return value === null || value === undefined || value === "" ? "—" : value;
}

export function BeforeTable({ report, product, branchNames }) {
  const nameDiffers = product.contradicciones.nombresDistintos > 1;
  const priceDiffers = product.contradicciones.preciosPublicadosDistintos;
  const stockDiffers = product.contradicciones.existenciasPublicadasDistintas;

  return (
    <div className="catalog-table-scroll" role="region" aria-label="Precios y existencias publicados" tabIndex="0">
      <table className="catalog-table">
        <caption>ANTES (como lo publica cada sucursal)</caption>
        <thead>
          <tr>
            <th scope="col">Sucursal</th>
            <th scope="col">Código</th>
            <th scope="col">Nombre publicado</th>
            <th scope="col">Unidad</th>
            <th scope="col">Precio publicado</th>
            <th scope="col">Existencia publicada</th>
            <th scope="col">Significado</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(report.sucursales).map(([branchId, branch]) => {
            const published = product.porSucursal[branchId];
            return (
              <tr key={branchId}>
                <th scope="row">{branchNames[branchId] || branchId}</th>
                <td>{showValue(published?.codigo)}</td>
                <td className={nameDiffers ? "catalog-different" : ""}>
                  {showValue(published?.nombrePublicado)}
                </td>
                <td>{showValue(published?.unidad)}</td>
                <td className={priceDiffers ? "catalog-different" : ""}>
                  {published?.precioPublicado === null || !published
                    ? "—"
                    : formatMXN(published.precioPublicado)}
                  {branch.convenciones.precioIncluyeIVA
                    ? <small className="catalog-tax-note">incluye IVA</small>
                    : null}
                </td>
                <td className={stockDiffers ? "catalog-different" : ""}>
                  {showValue(published?.existenciaPublicada)}
                </td>
                <td>
                  {branch.convenciones.existenciaSignifica === "fisica"
                    ? "Física"
                    : branch.convenciones.existenciaSignifica === "disponible"
                      ? "Disponible"
                      : "Indeterminada"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AfterTable({ existencias, branchNames, product }) {
  return (
    <div className="catalog-table-scroll" role="region" aria-label="Existencias normalizadas por sucursal" tabIndex="0">
      <table className="catalog-table">
        <caption>DESPUÉS (fuente única)</caption>
        <thead>
          <tr>
            <th scope="col">Sucursal</th>
            <th scope="col">Existencia física</th>
            <th scope="col">Disponible</th>
          </tr>
        </thead>
        <tbody>
          {existencias.length ? existencias.map((item) => (
            <tr key={`${item.idSucursal}-${item.claveProducto}`}>
              <th scope="row">{branchNames[item.idSucursal] || item.idSucursal}</th>
              <td>{item.existencia}</td>
              <td>{item.disponible}</td>
            </tr>
          )) : (
            <tr>
              <td colSpan="3">No hay existencias visibles para {product.claveProducto}.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function ReviewTable({ rows, branchNames }) {
  return (
    <div className="catalog-table-scroll" role="region" aria-label="Filas pendientes de revisión" tabIndex="0">
      <table className="catalog-table">
        <caption>Filas en revisión</caption>
        <thead>
          <tr>
            <th scope="col">Sucursal</th>
            <th scope="col">Fila</th>
            <th scope="col">Nombre publicado</th>
            <th scope="col">Mejor candidato</th>
            <th scope="col">Puntaje</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row) => (
            <tr key={`${row.sucursal}-${row.archivo}-${row.fila}`}>
              <th scope="row">{branchNames[row.sucursal] || row.sucursal}</th>
              <td>{row.fila}</td>
              <td>{row.nombrePublicado}</td>
              <td>{row.mejorCandidato?.nombre || "Sin candidato"}</td>
              <td>{Math.round(row.puntaje * 100)}%</td>
            </tr>
          )) : (
            <tr><td colSpan="5">No hay filas pendientes de revisión.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
