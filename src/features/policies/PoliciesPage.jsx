import { useEffect, useState } from "react";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle.js";
import { getRole } from "../auth/permissions.js";
import { useAuth } from "../auth/AuthContext.jsx";
import Button from "../../shared/ui/Button.jsx";
import Layout from "../../shared/ui/Layout.jsx";
import PolicyDetail from "./components/PolicyDetail.jsx";
import PolicyFilters from "./components/PolicyFilters.jsx";
import PolicyList from "./components/PolicyList.jsx";
import VersionComparison from "./components/VersionComparison.jsx";
import { policyService } from "./policyService.js";
import "./policies.css";

const TABS = [
  { id: "policies", label: "Políticas vigentes" },
  { id: "comparison", label: "Devoluciones: de tres versiones a una" },
];

export default function PoliciesPage() {
  useDocumentTitle("Políticas");
  const { session } = useAuth();
  const esEmpleado = getRole(session?.rol)?.esEmpleado === true;
  const [policies, setPolicies] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [policiesStatus, setPoliciesStatus] = useState("loading");
  const [comparisonStatus, setComparisonStatus] = useState(esEmpleado ? "loading" : "ready");
  const [policiesError, setPoliciesError] = useState("");
  const [comparisonError, setComparisonError] = useState("");
  const [texto, setTexto] = useState("");
  const [audiencia, setAudiencia] = useState("todas");
  const [tab, setTab] = useState("policies");
  const [retry, setRetry] = useState(0);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setPoliciesStatus("loading");
    setPoliciesError("");
    policyService.listPolicies(session, { texto, audiencia: esEmpleado ? audiencia : "todas" })
      .then((result) => {
        if (!active) return;
        setPolicies(result);
        setPoliciesStatus("ready");
      })
      .catch((error) => {
        if (!active) return;
        setPoliciesError("No se pudieron cargar las políticas.");
        setPoliciesStatus("error");
      });
    return () => { active = false; };
  }, [session, texto, audiencia, esEmpleado, retry]);

  useEffect(() => {
    if (!esEmpleado) {
      setComparisonStatus("ready");
      setComparison(null);
      setComparisonError("");
      return undefined;
    }
    let active = true;
    setComparisonStatus("loading");
    setComparisonError("");
    policyService.getComparison(session)
      .then((result) => {
        if (!active) return;
        setComparison(result);
        setComparisonStatus("ready");
      })
      .catch((error) => {
        if (!active) return;
        setComparisonError("No se pudo cargar la comparación de versiones.");
        setComparisonStatus("error");
      });
    return () => { active = false; };
  }, [session, esEmpleado, retry]);

  async function openPolicy(id) {
    setDetailError("");
    setDetailLoading(true);
    try {
      const policy = await policyService.getPolicy(session, id);
      if (!policy) {
        setDetailError("No se encontró una política disponible con ese identificador.");
        return;
      }
      setSelectedPolicy(policy);
    } catch (error) {
      setDetailError("No se pudo cargar la política.");
    } finally {
      setDetailLoading(false);
    }
  }

  function handleTabKeyDown(event) {
    const availableTabs = esEmpleado ? TABS : TABS.slice(0, 1);
    const currentIndex = availableTabs.findIndex((item) => item.id === tab);
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % availableTabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + availableTabs.length) % availableTabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = availableTabs.length - 1;
    else return;
    event.preventDefault();
    const nextTab = availableTabs[nextIndex];
    setTab(nextTab.id);
    document.getElementById(`policy-tab-${nextTab.id}`)?.focus();
  }

  const isLoading = policiesStatus === "loading" || comparisonStatus === "loading";
  const hasError = policiesStatus === "error" || comparisonStatus === "error";

  return (
    <Layout titulo="Políticas">
      <p className="policy-intro">Estas son las políticas vigentes de Río Claro.</p>
      {isLoading ? <p role="status">Cargando políticas…</p> : null}
      {hasError ? (
        <div className="policy-error" role="alert">
          <p>{policiesError || comparisonError}</p>
          <Button onClick={() => setRetry((current) => current + 1)}>Reintentar</Button>
        </div>
      ) : null}

      {policiesStatus === "ready" && comparisonStatus === "ready" ? (
        <>
          <PolicyFilters
            texto={texto}
            audiencia={audiencia}
            onTextoChange={setTexto}
            onAudienciaChange={setAudiencia}
            mostrarAudiencia={esEmpleado}
          />
          <div
            className="policy-tabs"
            role="tablist"
            aria-label="Contenido de políticas"
            onKeyDown={handleTabKeyDown}
          >
            <button
              id="policy-tab-policies"
              type="button"
              role="tab"
              aria-selected={tab === "policies"}
              aria-controls="policy-panel-policies"
              tabIndex={tab === "policies" ? 0 : -1}
              onClick={() => setTab("policies")}
            >
              Políticas vigentes
            </button>
            {esEmpleado ? (
              <button
                id="policy-tab-comparison"
                type="button"
                role="tab"
                aria-selected={tab === "comparison"}
                aria-controls="policy-panel-comparison"
                tabIndex={tab === "comparison" ? 0 : -1}
                onClick={() => setTab("comparison")}
              >
                Devoluciones: de tres versiones a una
              </button>
            ) : null}
          </div>

          <section
            id="policy-panel-policies"
            role="tabpanel"
            aria-labelledby="policy-tab-policies"
            hidden={tab !== "policies"}
            tabIndex="0"
          >
            {policiesStatus === "ready" && !policies.length ? (
              <p>No se encontró ninguna política.</p>
            ) : (
              <PolicyList policies={policies} onSelect={openPolicy} />
            )}
          </section>
          {esEmpleado ? (
            <section
              id="policy-panel-comparison"
              role="tabpanel"
              aria-labelledby="policy-tab-comparison"
              hidden={tab !== "comparison"}
              tabIndex="0"
            >
              {comparison ? (
                <VersionComparison comparison={comparison} onOpenPolicy={openPolicy} />
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}

      {detailLoading ? <p role="status">Cargando política…</p> : null}
      {detailError ? <p className="policy-error" role="alert">{detailError}</p> : null}
      <PolicyDetail policy={selectedPolicy} onClose={() => setSelectedPolicy(null)} />
    </Layout>
  );
}
