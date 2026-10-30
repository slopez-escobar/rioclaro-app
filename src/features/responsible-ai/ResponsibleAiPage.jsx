import { useMemo, useState } from "react";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle.js";
import { useAuth } from "../auth/AuthContext.jsx";
import Button from "../../shared/ui/Button.jsx";
import Layout from "../../shared/ui/Layout.jsx";
import { PRINCIPLES } from "./domain/principles.js";
import { responsibleAiService } from "./responsibleAiService.js";
import { downloadTextFile } from "./downloadTextFile.js";
import EvidenceSummaryBar from "./components/EvidenceSummaryBar.jsx";
import PrincipleCard from "./components/PrincipleCard.jsx";
import "./responsible-ai.css";

export default function ResponsibleAiPage() {
  useDocumentTitle("IA responsable");
  const { session } = useAuth();
  const checks = useMemo(() => responsibleAiService.getCheckCatalog(), []);
  const [results, setResults] = useState([]);
  const [running, setRunning] = useState(false);
  const [runningCheck, setRunningCheck] = useState("");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  const resultsById = useMemo(
    () => Object.fromEntries(results.map((result) => [result.id, result])),
    [results],
  );
  const isCustomer = session?.rol === "cliente";

  async function runAll() {
    setRunning(true);
    setError("");
    setProgress("Preparando comprobaciones aisladas…");
    try {
      const completed = await responsibleAiService.runAll((current, check) => {
        setResults(current);
        setProgress(`Comprobación ${current.length} de ${checks.length}: ${check.id}.`);
      }, session);
      setResults(completed);
      setProgress("Secuencia terminada.");
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "No se pudieron iniciar las comprobaciones.");
    } finally {
      setRunning(false);
    }
  }

  async function runCheck(id) {
    setRunning(true);
    setRunningCheck(id);
    setError("");
    try {
      const result = await responsibleAiService.runCheck(id, session);
      setResults((current) => [...current.filter((item) => item.id !== id), result]);
      setProgress(`Comprobación ${id} terminada.`);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : `No se pudo ejecutar ${id}.`);
    } finally {
      setRunning(false);
      setRunningCheck("");
    }
  }

  function downloadEvidence() {
    try {
      const markdown = responsibleAiService.buildEvidenceMarkdown(results, session);
      downloadTextFile("evidencia-ia-responsable-rioclaro.md", markdown);
      setError("");
    } catch (downloadError) {
      setError("No se pudo descargar la evidencia.");
    }
  }

  return (
    <Layout titulo="IA responsable">
      <p className="rai-intro">
        Seis principios, evidencia verificable y responsabilidades claras. Las pruebas usan servicios reales
        y datos de demostración aislados en memoria: no cambian pedidos, facturas, cuentas ni tu almacenamiento.
      </p>
      {isCustomer ? (
        <p className="rai-customer-notice" role="note">
          Puedes consultar el resultado general. La evidencia detallada de las sesiones de demostración se reserva
          al personal autorizado.
        </p>
      ) : null}
      <EvidenceSummaryBar
        checks={checks}
        results={results}
        running={running}
        progress={progress}
      />
      {error ? (
        <div className="rai-error" role="alert">
          <p>{error}</p>
          <Button variant="secondary" onClick={runAll} disabled={running}>Reintentar</Button>
        </div>
      ) : null}
      <div className="rai-toolbar">
        <Button onClick={runAll} disabled={running}>
          {running ? "Ejecutando secuencia…" : "Ejecutar las 22 comprobaciones"}
        </Button>
        <Button
          variant="secondary"
          onClick={downloadEvidence}
          disabled={!results.length || running}
        >
          Descargar evidencia (.md)
        </Button>
        <p className="rai-toolbar-note">Las 19 pruebas locales se ejecutan una por una; Azure y revisión manual quedan señalados.</p>
      </div>
      {results.length === 0 ? (
        <p className="rai-check-note">Aún no se ejecutan comprobaciones. Puedes iniciar toda la secuencia o probar una por separado.</p>
      ) : null}
      {PRINCIPLES.map((principle) => (
        <PrincipleCard
          key={principle.id}
          principle={principle}
          checks={checks.filter((check) => check.principio === principle.id)}
          resultsById={resultsById}
          running={running}
          onRun={runCheck}
          runningCheck={runningCheck}
          isCustomer={isCustomer}
        />
      ))}
    </Layout>
  );
}
