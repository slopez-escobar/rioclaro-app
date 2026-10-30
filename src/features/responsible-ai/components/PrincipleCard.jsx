import { Link } from "react-router-dom";
import CheckResult from "./CheckResult.jsx";

export default function PrincipleCard({
  principle,
  checks,
  resultsById,
  running,
  onRun,
  runningCheck,
  isCustomer,
}) {
  return (
    <section className="rai-principle" aria-labelledby={`rai-${principle.id}`}>
      <div className="rai-principle-heading">
        <span className="rai-principle-number" aria-hidden="true">{principle.id.slice(0, 2).toUpperCase()}</span>
        <div>
          <h2 id={`rai-${principle.id}`}>{principle.nombre}</h2>
          <p>{principle.pregunta}</p>
        </div>
      </div>
      <details className="rai-principle-details">
        <summary>Qué hace Río Claro hoy</summary>
        <ul>
          {principle.queHace.map((fact) => (
            <li key={`${fact.ruta}-${fact.texto}`}>
              {fact.texto} <Link to={fact.ruta}>Abrir</Link>
            </li>
          ))}
        </ul>
      </details>
      <div className="rai-check-list">
        {checks.map((check) => (
          <CheckResult
            key={check.id}
            check={check}
            result={resultsById[check.id]}
            running={running}
            onRun={onRun}
            runningCheck={runningCheck}
            isCustomer={isCustomer}
          />
        ))}
      </div>
    </section>
  );
}
