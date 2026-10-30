import Tag from "../../../shared/ui/Tag.jsx";
import { ESTATUS_LABEL, ESTATUS_VARIANT } from "../domain/index.js";

function StockTag({ status, quantity }) {
  const { variant, symbol } = ESTATUS_VARIANT[status];
  return (
    <Tag variant={variant}>
      <span aria-hidden="true">{symbol} </span>
      {ESTATUS_LABEL[status]} · {quantity}
    </Tag>
  );
}

function BranchName({ branch }) {
  return branch.ciudad || branch.nombre;
}

function BranchStock({ record }) {
  if (!record) return <td>—</td>;
  return (
    <td>
      <StockTag status={record.estatusStock} quantity={record.disponible} />
      <span className="inventory-available">{record.disponible} disponibles</span>
    </td>
  );
}

export default function InventoryTable({ filas, alcance, sucursales, onSelect }) {
  if (!filas.length) {
    return <p className="inventory-empty">No se encontró ningún producto. Prueba con otro nombre.</p>;
  }

  return (
    <div className="inventory-table-scroll" role="region" aria-label="Existencias por producto" tabIndex={0}>
      <table className="inventory-table">
        <caption>Existencias visibles dentro del alcance autorizado</caption>
        <thead>
          <tr>
            <th scope="col">Producto</th>
            <th scope="col">Categoría</th>
            {alcance === "sucursal" ? (
              <>
                <th scope="col" title="Unidades que hay físicamente en la sucursal">Existencia</th>
                <th scope="col" title="Unidades comprometidas en pedidos por surtir">Comprometido</th>
                <th scope="col" title="Disponible = existencia física menos comprometido">Disponible</th>
                <th scope="col">Estatus</th>
                <th scope="col">Punto de reorden</th>
              </>
            ) : (
              <>
                {sucursales.map((branch) => (
                  <th scope="col" key={branch.id} title="Unidades disponibles en esta sucursal (POL-12)">
                    Disponible · <BranchName branch={branch} />
                  </th>
                ))}
                <th scope="col" title="Suma del disponible en todas las sucursales visibles">
                  Total disponible
                </th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {filas.map((row) => {
            const branchRecord = Object.values(row.sucursales)[0];
            return (
              <tr
                key={row.claveProducto}
                className="inventory-row"
                tabIndex={0}
                onClick={() => onSelect(row.claveProducto)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(row.claveProducto);
                  }
                }}
              >
                <th scope="row">
                  <span>{row.nombre}</span>
                  <small>{row.claveProducto} · {row.presentacion}</small>
                </th>
                <td>{row.categoria}</td>
                {alcance === "sucursal" ? (
                  <>
                    <td>{branchRecord?.existencia ?? "—"}</td>
                    <td>{branchRecord?.comprometido ?? "—"}</td>
                    <td className="inventory-available">{branchRecord?.disponible ?? "—"}</td>
                    <td>
                      {branchRecord
                        ? <StockTag status={branchRecord.estatusStock} quantity={branchRecord.disponible} />
                        : "—"}
                    </td>
                    <td>{branchRecord?.puntoReorden ?? "—"}</td>
                  </>
                ) : (
                  <>
                    {sucursales.map((branch) => (
                      <BranchStock
                        key={branch.id}
                        record={row.sucursales[branch.id]}
                      />
                    ))}
                    <td className="inventory-available inventory-total">{row.totales.disponible}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
