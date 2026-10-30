import Button from "../../../shared/ui/Button.jsx";

const THEME_LABELS = {
  sin_existencia: "Falta de existencia",
  error_de_captura: "Error de captura",
  entrega_fallida: "Entrega fallida",
  cobro_duplicado: "Cobro duplicado",
  cancelacion_solicitada: "Cancelación solicitada",
  sin_clasificar: "Sin clasificar",
};

/**
 * Presenta grupos repetidos y permite abrir cada queja relacionada.
 * @param {{grupos:Object[],onSelect:Function}} props Grupos y selección.
 * @returns {import("react").JSX.Element} Lista agrupada de casos.
 */
export default function RepeatedCases({ grupos, onSelect }) {
  return (
    <section className="quejas-repeated" aria-labelledby="quejas-repeated-title">
      <h2 id="quejas-repeated-title">Casos repetidos</h2>
      {grupos.length ? (
        <ul className="quejas-repeated-list">
          {grupos.map((group) => (
            <li className="quejas-repeated-card" key={group.grupoId}>
              <h3>{group.clienteNombre}</h3>
              <p>{THEME_LABELS[group.tema] || group.tema} · {group.total} quejas</p>
              <ul className="quejas-repeated-folios">
                {group.folios.map((complaint) => (
                  <li key={complaint.idQueja}>
                    <Button variant="secondary" onClick={() => onSelect(complaint.idQueja)}>
                      {complaint.folio}
                    </Button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : <p className="quejas-empty">No hay casos repetidos visibles.</p>}
    </section>
  );
}
