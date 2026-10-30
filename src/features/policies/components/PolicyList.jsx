export default function PolicyList({ policies, onSelect }) {
  return (
    <ul className="policy-list" aria-label="Políticas vigentes">
      {policies.map((policy) => (
        <li key={policy.id}>
          <button
            type="button"
            className="policy-list-item"
            onClick={() => onSelect(policy.id)}
          >
            <span className="policy-list-title">
              <strong>{policy.id}</strong> · {policy.titulo}
            </span>
            <span className="policy-list-meta">
              Versión {policy.version} · Vigente desde {policy.vigenteDesde}
            </span>
            <span className={`policy-audience policy-audience-${policy.audiencia}`}>
              {policy.audiencia === "publica" ? "◉ Pública" : "◆ Interna"}
            </span>
            <span className="policy-list-responsible">
              Responsable: {policy.responsable.nombre} · {policy.responsable.puesto}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
