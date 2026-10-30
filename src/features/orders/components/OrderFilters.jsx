import Button from "../../../shared/ui/Button.jsx";

export default function OrderFilters({
  filters,
  onChange,
  sucursales,
  estados,
  mostrarSucursal,
}) {
  function update(name, value) {
    onChange({ ...filters, [name]: value });
  }

  function reset() {
    onChange({ estado: "", desde: "", hasta: "", tipoEntrega: "", idSucursal: "", texto: "" });
  }

  return (
    <form className="pedidos-filters" aria-label="Filtros de pedidos" onSubmit={(event) => event.preventDefault()}>
      <label className="campo">
        <span>Buscar pedido o cliente</span>
        <input
          type="search"
          value={filters.texto}
          onChange={(event) => update("texto", event.target.value)}
          placeholder="Folio, cliente, producto…"
        />
      </label>
      <label className="campo">
        <span>Estatus</span>
        <select value={filters.estado} onChange={(event) => update("estado", event.target.value)}>
          <option value="">Todos</option>
          {estados.map((state) => (
            <option value={state.codigo} key={state.codigo}>{state.descripcion}</option>
          ))}
        </select>
      </label>
      <label className="campo">
        <span>Desde</span>
        <input type="date" value={filters.desde} onChange={(event) => update("desde", event.target.value)} />
      </label>
      <label className="campo">
        <span>Hasta</span>
        <input type="date" value={filters.hasta} onChange={(event) => update("hasta", event.target.value)} />
      </label>
      <label className="campo">
        <span>Entrega</span>
        <select value={filters.tipoEntrega} onChange={(event) => update("tipoEntrega", event.target.value)}>
          <option value="">Todas</option>
          <option value="envio_a_domicilio">Envío a domicilio</option>
          <option value="recoger_en_sucursal">Recoger en sucursal</option>
        </select>
      </label>
      {mostrarSucursal ? (
        <label className="campo">
          <span>Sucursal de venta</span>
          <select value={filters.idSucursal} onChange={(event) => update("idSucursal", event.target.value)}>
            <option value="">Todas</option>
            {sucursales.map((branch) => (
              <option value={branch.id} key={branch.id}>{branch.ciudad || branch.nombre}</option>
            ))}
          </select>
        </label>
      ) : null}
      <Button variant="secondary" onClick={reset}>Limpiar filtros</Button>
    </form>
  );
}
