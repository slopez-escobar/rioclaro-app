import Button from "../../../shared/ui/Button.jsx";
import Dialog from "../../../shared/ui/Dialog.jsx";

export default function PolicyDetail({ policy, onClose }) {
  if (!policy) return null;

  return (
    <Dialog
      open
      onClose={onClose}
      labelledBy="policy-detail-title"
      className="policy-detail-dialog"
    >
      <div className="policy-detail-header">
        <div>
          <p className="eyebrow">{policy.id} · Versión {policy.version}</p>
          <h2 id="policy-detail-title">{policy.titulo}</h2>
          <p>Vigente desde {policy.vigenteDesde}</p>
          <p>
            Responsable: {policy.responsable.nombre} · {policy.responsable.puesto}
          </p>
        </div>
        <Button variant="ghost" onClick={onClose} aria-label="Cerrar detalle">
          Cerrar
        </Button>
      </div>
      <div className="policy-detail-content">
        <section>
          <h3>Propósito</h3>
          <p>{policy.proposito}</p>
        </section>
        <section>
          <h3>Alcance</h3>
          <p>{policy.alcance}</p>
        </section>
        <section>
          <h3>Reglas</h3>
          <ul>
            {policy.reglas.map((rule, index) => (
              <li key={`${rule.tema}-${index}`}>
                <strong>{rule.tema}:</strong> {rule.texto}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3>Procedimiento</h3>
          <ol>
            {policy.procedimiento.map((step, index) => (
              <li key={`${policy.id}-step-${index}`}>{step}</li>
            ))}
          </ol>
        </section>
      </div>
    </Dialog>
  );
}
