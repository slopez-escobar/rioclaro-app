import Input from "../../../shared/ui/Input.jsx";

const AUDIENCES = [
  { value: "todas", label: "Todas" },
  { value: "publica", label: "Públicas" },
  { value: "interna", label: "Internas" },
];

export default function PolicyFilters({
  texto,
  audiencia,
  onTextoChange,
  onAudienciaChange,
  mostrarAudiencia,
}) {
  return (
    <section className="policy-filters" aria-label="Filtros de políticas">
      <Input
        label="Buscar políticas"
        type="search"
        value={texto}
        onChange={(event) => onTextoChange(event.target.value)}
        placeholder="Título, propósito o reglas"
      />
      {mostrarAudiencia ? (
        <div className="policy-audience-filter" aria-label="Filtrar por audiencia">
          {AUDIENCES.map((option) => (
            <button
              key={option.value}
              type="button"
              className="policy-chip"
              aria-pressed={audiencia === option.value}
              onClick={() => onAudienciaChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
