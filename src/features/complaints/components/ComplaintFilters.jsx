import { useId } from "react";

const STATUSES = [
  ["", "Todas"],
  ["abierta", "Abiertas"],
  ["en_atencion", "En atención"],
  ["escalada", "Escaladas"],
  ["resuelta", "Resueltas"],
  ["cerrada", "Cerradas"],
];
const THEMES = [
  ["sin_existencia", "Falta de existencia"],
  ["error_de_captura", "Error de captura"],
  ["entrega_fallida", "Entrega fallida"],
  ["cobro_duplicado", "Cobro duplicado"],
  ["cancelacion_solicitada", "Cancelación solicitada"],
  ["sin_clasificar", "Sin clasificar"],
];
const PRIORITIES = [["", "Todas"], ["alta", "Alta"], ["media", "Media"], ["baja", "Baja"]];

/**
 * Controles de filtro declarativos para la lista de quejas.
 * @param {Object} props Filtros, callback y opciones de sucursal.
 * @returns {import("react").JSX.Element} Controles accesibles de filtrado.
 */
export default function ComplaintFilters({
  filtros,
  onChange,
  mostrarSucursal,
  sucursales = [],
}) {
  const id = useId();
  const update = (key) => (event) => {
    const { type, checked, value } = event.target;
    onChange({
      ...filtros,
      [key]: type === "checkbox" ? (checked ? true : undefined) : value || undefined,
    });
  };
  return (
    <section className="quejas-filters" aria-label="Filtros de quejas">
      <div className="quejas-status-chips" aria-label="Filtrar por estatus">
        {STATUSES.map(([value, label]) => (
          <button
            className={`quejas-chip${(filtros.estatus || "") === value ? " activo" : ""}`}
            key={value || "todas"}
            type="button"
            aria-pressed={(filtros.estatus || "") === value}
            onClick={() => onChange({ ...filtros, estatus: value || undefined })}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="quejas-filter-grid">
        <div className="campo">
          <label htmlFor={`${id}-tema`}>Tema</label>
          <select id={`${id}-tema`} value={filtros.tema || ""} onChange={update("tema")}>
            <option value="">Todos los temas</option>
            {THEMES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor={`${id}-prioridad`}>Prioridad</label>
          <select id={`${id}-prioridad`} value={filtros.prioridad || ""} onChange={update("prioridad")}>
            {PRIORITIES.map(([value, label]) => <option key={value || "todas"} value={value}>{label}</option>)}
          </select>
        </div>
        {mostrarSucursal ? (
          <div className="campo">
            <label htmlFor={`${id}-sucursal`}>Sucursal</label>
            <select id={`${id}-sucursal`} value={filtros.idSucursal || ""} onChange={update("idSucursal")}>
              <option value="">Todas las sucursales</option>
              {sucursales.map((branch) => <option key={branch.id} value={branch.id}>{branch.nombre}</option>)}
            </select>
          </div>
        ) : null}
        <div className="campo quejas-search">
          <label htmlFor={`${id}-texto`}>Buscar</label>
          <input
            id={`${id}-texto`}
            type="search"
            value={filtros.texto || ""}
            onChange={update("texto")}
            placeholder="Descripción, folio o cliente"
          />
        </div>
        <div className="campo quejas-date">
          <label htmlFor={`${id}-desde`}>Desde</label>
          <input id={`${id}-desde`} type="date" value={filtros.desde || ""} onChange={update("desde")} />
        </div>
        <div className="campo quejas-date">
          <label htmlFor={`${id}-hasta`}>Hasta</label>
          <input id={`${id}-hasta`} type="date" value={filtros.hasta || ""} onChange={update("hasta")} />
        </div>
      </div>
      <div className="quejas-checks">
        <label>
          <input
            type="checkbox"
            checked={Boolean(filtros.casoRepetido)}
            onChange={update("casoRepetido")}
          />
          Solo casos repetidos
        </label>
        <label>
          <input
            type="checkbox"
            checked={Boolean(filtros.surtidoEnOtraSucursal)}
            onChange={update("surtidoEnOtraSucursal")}
          />
          Surtido en otra sucursal
        </label>
      </div>
    </section>
  );
}
