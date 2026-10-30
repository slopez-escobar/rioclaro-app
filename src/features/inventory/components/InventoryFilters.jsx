import { ESTATUS_LABEL } from "../domain/index.js";

const STATUS_OPTIONS = [
  ["", "Todos"],
  ["agotado", ESTATUS_LABEL.agotado],
  ["bajo", ESTATUS_LABEL.bajo],
  ["normal", ESTATUS_LABEL.normal],
  ["exceso", ESTATUS_LABEL.exceso],
];

export default function InventoryFilters({
  filtros,
  onChange,
  categorias,
  sucursales,
  mostrarSucursal,
}) {
  function update(name, value) {
    onChange({ ...filtros, [name]: value });
  }

  return (
    <section className="inventory-filters" aria-label="Filtros de existencias">
      <label className="inventory-search">
        <span>Buscar producto</span>
        <input
          type="search"
          value={filtros.texto}
          onChange={(event) => update("texto", event.target.value)}
          placeholder="Nombre, clave o alias de sucursal"
          aria-describedby="inventory-search-help"
        />
        <small id="inventory-search-help">
          Escribe un nombre, una clave o el nombre que usa tu sucursal (por ejemplo: cloro litro)
        </small>
      </label>

      <fieldset className="inventory-status-filters">
        <legend>Estatus</legend>
        <div className="inventory-chips">
          {STATUS_OPTIONS.map(([value, label]) => (
            <button
              type="button"
              key={value || "todos"}
              className="inventory-chip"
              aria-pressed={filtros.estatus === value}
              onClick={() => update("estatus", value)}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="inventory-select">
        <span>Categoría</span>
        <select value={filtros.categoria} onChange={(event) => update("categoria", event.target.value)}>
          <option value="">Todas</option>
          {categorias.map((categoria) => <option value={categoria} key={categoria}>{categoria}</option>)}
        </select>
      </label>

      {mostrarSucursal ? (
        <label className="inventory-select">
          <span>Sucursal</span>
          <select value={filtros.idSucursal} onChange={(event) => update("idSucursal", event.target.value)}>
            <option value="">Todas</option>
            {sucursales.map((branch) => (
              <option value={branch.id} key={branch.id}>{branch.ciudad || branch.nombre}</option>
            ))}
          </select>
        </label>
      ) : null}
    </section>
  );
}
