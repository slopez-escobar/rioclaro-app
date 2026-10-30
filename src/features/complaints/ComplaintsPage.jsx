import { useCallback, useEffect, useState } from "react";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle.js";
import { canAttend } from "./domain/complaintActions.js";
import { complaintService } from "./complaintService.js";
import ComplaintActionDialog from "./components/ComplaintActionDialog.jsx";
import ComplaintDetail from "./components/ComplaintDetail.jsx";
import ComplaintFilters from "./components/ComplaintFilters.jsx";
import ComplaintKpiBar from "./components/ComplaintKpiBar.jsx";
import ComplaintTable from "./components/ComplaintTable.jsx";
import RepeatedCases from "./components/RepeatedCases.jsx";
import Button from "../../shared/ui/Button.jsx";
import Dialog from "../../shared/ui/Dialog.jsx";
import Layout from "../../shared/ui/Layout.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import "./complaints.css";

const EMPTY_FILTERS = {};

/**
 * Pantalla de consulta y atención de quejas según los permisos y alcance actuales.
 * @returns {import("react").JSX.Element} Pantalla principal de quejas.
 */
export default function ComplaintsPage() {
  useDocumentTitle("Quejas");
  const { session } = useAuth();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [complaints, setComplaints] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [groups, setGroups] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [tab, setTab] = useState("all");
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetError, setResetError] = useState("");
  const [announcement, setAnnouncement] = useState("");

  const loadData = useCallback(async () => Promise.all([
    complaintService.list(session, filters),
    complaintService.kpis(session),
    complaintService.repeatedGroups(session),
    Promise.resolve(complaintService.branchOptions(session)),
  ]), [session, filters]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    loadData()
      .then(([nextComplaints, nextKpis, nextGroups, nextBranches]) => {
        if (!active) return;
        setComplaints(nextComplaints);
        setKpis(nextKpis);
        setGroups(nextGroups);
        setBranches(nextBranches);
      })
      .catch((issue) => {
        if (active) setError("No se pudieron cargar las quejas.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [loadData, retry]);

  async function refreshData() {
    const [nextComplaints, nextKpis, nextGroups, nextBranches] = await loadData();
    setComplaints(nextComplaints);
    setKpis(nextKpis);
    setGroups(nextGroups);
    setBranches(nextBranches);
  }

  async function selectComplaint(idQueja) {
    try {
      const complaint = await complaintService.get(session, idQueja);
      setSelectedComplaint(complaint);
    } catch (issue) {
      setError("No se pudo abrir la queja.");
    }
  }

  async function submitAction({ comentario, calificacion }) {
    if (!selectedComplaint || !pendingAction) return;
    const { folio, idQueja } = selectedComplaint;
    const action = pendingAction;
    await complaintService.act(session, idQueja, {
      accion: action,
      comentario,
      calificacion,
    });
    await refreshData();
    const updated = await complaintService.get(session, idQueja);
    setSelectedComplaint(updated);
    setPendingAction(null);
    setAnnouncement(`Queja ${folio}: ${action} registrada.`);
  }

  async function resetDemo() {
    setResetError("");
    try {
      await complaintService.reset(session);
      await refreshData();
      setSelectedComplaint(null);
      setResetOpen(false);
      setAnnouncement("La demo de quejas se restableció.");
    } catch (issue) {
      setResetError(issue instanceof Error ? issue.message : "No se pudo restablecer la demo de quejas.");
    }
  }

  return (
    <Layout titulo="Quejas de clientes">
      <p className="quejas-objective" role="note">
        Objetivo de primera respuesta: 15 minutos en horario de atención (POL-07).
      </p>

      {kpis ? <ComplaintKpiBar kpis={kpis} /> : null}

      {canAttend(session) ? (
        <div className="quejas-reset-bar">
          <Button variant="secondary" onClick={() => setResetOpen(true)}>
            Restablecer demo de quejas
          </Button>
        </div>
      ) : null}

      <div className="quejas-tabs" role="tablist" aria-label="Vistas de quejas">
        <button
          id="quejas-tab-all"
          type="button"
          role="tab"
          aria-selected={tab === "all"}
          aria-controls="quejas-panel"
          onClick={() => setTab("all")}
        >
          Todas las quejas
        </button>
        <button
          id="quejas-tab-repeated"
          type="button"
          role="tab"
          aria-selected={tab === "repeated"}
          aria-controls="quejas-panel"
          onClick={() => setTab("repeated")}
        >
          Casos repetidos ({kpis?.gruposRepetidos ?? 0})
        </button>
      </div>

      <section
        id="quejas-panel"
        className="quejas-panel"
        role="tabpanel"
        aria-labelledby={tab === "all" ? "quejas-tab-all" : "quejas-tab-repeated"}
        tabIndex={0}
      >
        {tab === "all" ? (
          <>
            <ComplaintFilters
              filtros={filters}
              onChange={setFilters}
              mostrarSucursal={session?.alcance === "todas"}
              sucursales={branches}
            />
            {loading ? <p className="quejas-state">Cargando quejas…</p> : null}
            {error ? (
              <div className="quejas-error-panel" role="alert">
                <p>{error}</p>
                <Button variant="secondary" onClick={() => setRetry((value) => value + 1)}>
                  Reintentar
                </Button>
              </div>
            ) : null}
            {!loading && !error ? (
              <ComplaintTable
                quejas={complaints}
                onSelect={selectComplaint}
                selectedId={selectedComplaint?.idQueja}
              />
            ) : null}
          </>
        ) : (
          <>
            {loading ? <p className="quejas-state">Cargando quejas…</p> : null}
            {error ? (
              <div className="quejas-error-panel" role="alert">
                <p>{error}</p>
                <Button variant="secondary" onClick={() => setRetry((value) => value + 1)}>
                  Reintentar
                </Button>
              </div>
            ) : null}
            {!loading && !error ? <RepeatedCases grupos={groups} onSelect={selectComplaint} /> : null}
          </>
        )}
      </section>

      <p className="quejas-announcement" aria-live="polite" aria-atomic="true">{announcement}</p>

      <ComplaintDetail
        queja={selectedComplaint}
        onClose={() => setSelectedComplaint(null)}
        onAction={(accion) => setPendingAction(accion)}
        onOpenOther={selectComplaint}
      />
      {pendingAction && selectedComplaint ? (
        <ComplaintActionDialog
          key={`${pendingAction}-${selectedComplaint.idQueja}`}
          accion={pendingAction}
          queja={selectedComplaint}
          onConfirm={submitAction}
          onCancel={() => setPendingAction(null)}
        />
      ) : null}

      <Dialog
        open={resetOpen}
        onClose={() => {
          setResetOpen(false);
          setResetError("");
        }}
        labelledBy="quejas-reset-title"
        className="quejas-dialog quejas-reset-dialog"
      >
        <div className="quejas-dialog-content">
          <header className="quejas-dialog-header">
            <h2 id="quejas-reset-title">Restablecer demo de quejas</h2>
          </header>
          <p>Se eliminarán las acciones guardadas y las quejas nuevas. Las quejas base, facturas y el historial del asistente no cambiarán.</p>
          {resetError ? <p className="quejas-error" role="alert">{resetError}</p> : null}
          <div className="quejas-dialog-actions">
            <Button variant="danger" onClick={resetDemo}>Restablecer</Button>
            <Button variant="secondary" onClick={() => setResetOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Dialog>
    </Layout>
  );
}
