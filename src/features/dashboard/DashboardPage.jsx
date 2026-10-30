import { useCallback, useEffect, useState } from "react";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { can } from "../auth/permissions.js";
import Button from "../../shared/ui/Button.jsx";
import Layout from "../../shared/ui/Layout.jsx";
import { dashboardService } from "./dashboardService.js";
import ComplaintsBlock from "./components/ComplaintsBlock.jsx";
import CostBlock from "./components/CostBlock.jsx";
import InvoicesBlock from "./components/InvoicesBlock.jsx";
import OperationsBlock from "./components/OperationsBlock.jsx";
import SalesBlock from "./components/SalesBlock.jsx";
import "./dashboard.css";

export default function DashboardPage() {
  useDocumentTitle("Panel");
  const { session } = useAuth();
  const [panel, setPanel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPanel = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPanel(await dashboardService.getPanel(session));
    } catch (loadError) {
      setError("No se pudo cargar el panel.");
      setPanel(null);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { loadPanel(); }, [loadPanel]);

  const detail = (modulo, to, label) => ({
    to,
    label,
    canOpen: can(session?.rol, modulo, modulo === "asistente_ia" ? "usar" : "ver"),
  });

  return (
    <Layout titulo="Panel de dirección">
      <div className="dashboard-intro">
        <p>Cada cifra indica de dónde sale.</p>
        <Button variant="secondary" onClick={loadPanel} disabled={loading}>
          {loading ? "Actualizando…" : "Actualizar"}
        </Button>
      </div>
      {loading ? <p role="status">Cargando panel…</p> : null}
      {!loading && error ? (
        <div className="dashboard-error" role="alert">
          <p>{error}</p>
          <Button onClick={loadPanel}>Reintentar</Button>
        </div>
      ) : null}
      {!loading && panel ? (
        <div className="dashboard-grid">
          <SalesBlock block={panel.ventas} detailLinks={[
            detail("reporte_ventas", "/ventas", "Ventas"),
          ]} />
          <InvoicesBlock block={panel.facturas} detailLinks={[
            detail("facturas_proveedores", "/facturas", "Facturas"),
          ]} />
          <ComplaintsBlock block={panel.quejas} detailLinks={[
            detail("quejas", "/quejas", "Quejas"),
          ]} />
          <OperationsBlock block={panel.existencias} detailLinks={[
            detail("existencias", "/existencias", "Existencias"),
            detail("pedidos", "/pedidos", "Pedidos"),
          ]} />
          <CostBlock block={panel.costo} />
        </div>
      ) : null}
    </Layout>
  );
}
