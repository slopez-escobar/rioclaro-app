import Button from "../../../shared/ui/Button.jsx";
import EvidenceTable from "./EvidenceTable.jsx";

const STATUS_LABELS = {
  pasa: "Aprobada",
  falla: "Requiere atención",
  pendiente: "Pendiente en Azure",
  manual: "Revisión manual",
};

export default function CheckResult({
  check,
  result,
  running,
  onRun,
  runningCheck,
  isCustomer,
}) {
  const status = result?.estado || (check.tipo === "local" ? "sin_ejecutar" : check.tipo);
  const label = STATUS_LABELS[status] || "Sin ejecutar";
  return (
    <article className={`rai-check rai-check-${status}`}>
      <div className="rai-check-heading">
        <div>
          <p className="rai-check-id">{check.id}</p>
          <h3>{check.titulo}</h3>
        </div>
        <span className="rai-check-status">
          <span aria-hidden="true">
            {status === "pasa" ? "✓" : status === "falla" ? "!" : status === "pendiente" ? "…" : "○"}
          </span>
          {" "}{label}
        </span>
      </div>
      <p>{isCustomer && check.tipo === "local"
        ? "Comprobación de demostración ejecutable con datos aislados."
        : check.descripcion}</p>
      {result?.resumen ? <p className={status === "falla" ? "rai-check-error" : ""}>{result.resumen}</p> : null}
      {!result && check.nota ? <p className="rai-check-note">{check.nota}</p> : null}
      {result?.nota ? <p className="rai-check-note">{result.nota}</p> : null}
      <EvidenceTable evidencia={result?.evidencia} />
      {check.tipo === "local" ? (
        <Button
          variant="secondary"
          onClick={() => onRun(check.id)}
          disabled={running}
        >
          {running && runningCheck === check.id
            ? "Ejecutando…"
            : result ? "Volver a ejecutar" : "Ejecutar comprobación"}
        </Button>
      ) : null}
    </article>
  );
}
