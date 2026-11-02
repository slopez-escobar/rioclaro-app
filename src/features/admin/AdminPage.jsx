import { useEffect, useState } from "react";
import { USE_AZURE } from "../../config/env.js";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle.js";
import { can } from "../auth/permissions.js";
import { useAuth } from "../auth/AuthContext.jsx";
import Button from "../../shared/ui/Button.jsx";
import DemoResetDialog from "../../shared/ui/DemoResetDialog.jsx";
import Layout from "../../shared/ui/Layout.jsx";
import AccountFilters from "./components/AccountFilters.jsx";
import AccountTable from "./components/AccountTable.jsx";
import AdminPagination from "./components/AdminPagination.jsx";
import AdminSummaryBar from "./components/AdminSummaryBar.jsx";
import AssistantControl from "./components/AssistantControl.jsx";
import AzureStatus from "./components/AzureStatus.jsx";
import AuditLog from "./components/AuditLog.jsx";
import DisableAccountDialog from "./components/DisableAccountDialog.jsx";
import RoleMatrix from "./components/RoleMatrix.jsx";
import { adminService } from "./adminService.js";
import { getHealth } from "./healthService.js";
import { demoService } from "../demo/demoService.js";
import "./admin.css";

const TABS = [
  { id: "accounts", label: "Cuentas" },
  { id: "roles", label: "Roles y permisos" },
  { id: "audit", label: "Auditoría" },
];
const PAGE_SIZE = 20;

export default function AdminPage() {
  useDocumentTitle("Administración");
  const { session } = useAuth();
  const [summary, setSummary] = useState(null);
  const [accounts, setAccounts] = useState(null);
  const [disableRules, setDisableRules] = useState({});
  const [filters, setFilters] = useState({
    texto: "",
    rol: "todos",
    idSucursal: "todas",
    estado: "todos",
    tipo: "todos",
  });
  const [filterOptions, setFilterOptions] = useState({ roles: [], sucursales: [] });
  const [matrix, setMatrix] = useState(null);
  const [auditEntries, setAuditEntries] = useState([]);
  const [assistantEnabled, setAssistantEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState("accounts");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [disableDialogError, setDisableDialogError] = useState("");
  const [retry, setRetry] = useState(0);
  const [resetOpen, setResetOpen] = useState(false);
  const [azureHealth, setAzureHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthRetry, setHealthRetry] = useState(0);
  const canViewServices = can(session?.rol, "usuarios_y_accesos", "ver");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    try {
      const nextSummary = adminService.getSummary(session);
      const nextAccounts = adminService.listAccounts(session, filters, {
        page,
        pageSize: PAGE_SIZE,
      });
      const nextRules = Object.fromEntries(nextAccounts.cuentas.map((account) => [
        account.usuario,
        adminService.getDisableAccountRule(session, account.usuario),
      ]));
      const options = adminService.getFilterOptions(session);
      const nextMatrix = adminService.getRoleMatrix(session);
      const nextAudit = adminService.listAudit(session);
      const nextAssistantState = adminService.getAssistantState(session);
      if (active) {
        setSummary(nextSummary);
        setAccounts(nextAccounts);
        setDisableRules(nextRules);
        setFilterOptions(options);
        setMatrix(nextMatrix);
        setAuditEntries(nextAudit);
        setAssistantEnabled(nextAssistantState.enabled);
      }
    } catch (issue) {
      if (active) setError(issue instanceof Error ? issue.message : "No se pudo cargar la administración.");
    } finally {
      if (active) setLoading(false);
    }
    return () => { active = false; };
  }, [session, filters, page, retry]);

  useEffect(() => {
    if (!canViewServices || !USE_AZURE) return undefined;
    let active = true;
    setHealthLoading(true);
    getHealth().then((result) => {
      if (active) setAzureHealth(result);
    }).finally(() => {
      if (active) setHealthLoading(false);
    });
    return () => { active = false; };
  }, [canViewServices, healthRetry]);

  function changeFilters(next) {
    setFilters(next);
    setPage(1);
  }

  function handleTabKeyDown(event) {
    const index = TABS.findIndex((tab) => tab.id === activeTab);
    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = TABS.length - 1;
    else return;
    event.preventDefault();
    setActiveTab(TABS[nextIndex].id);
    document.getElementById(`admin-tab-${TABS[nextIndex].id}`)?.focus();
  }

  async function disableAccount(usuario, motivo) {
    setActionError("");
    try {
      adminService.disableAccount(session, usuario, motivo);
      setSelectedAccount(null);
      setSuccess(`La cuenta ${usuario} quedó desactivada.`);
      setRetry((value) => value + 1);
    } catch (issue) {
      setDisableDialogError(issue instanceof Error ? issue.message : "No se pudo desactivar la cuenta.");
    }
  }

  function handleEnable(account) {
    setActionError("");
    try {
      adminService.enableAccount(session, account.usuario);
      setSuccess(`La cuenta ${account.usuario} quedó reactivada.`);
      setRetry((value) => value + 1);
    } catch (issue) {
      setActionError(issue instanceof Error ? issue.message : "No se pudo reactivar la cuenta.");
    }
  }

  function handleAssistantToggle(value) {
    if (!globalThis.confirm(
      value
        ? "¿Quieres encender el asistente para todas las personas?"
        : "¿Quieres apagar el asistente para todas las personas?",
    )) return;
    setActionBusy(true);
    setActionError("");
    try {
      const enabled = adminService.setAssistantEnabled(session, value);
      setAssistantEnabled(enabled);
      setSuccess(`Asistente ${enabled ? "encendido" : "apagado"}.`);
      setRetry((current) => current + 1);
    } catch (issue) {
      setActionError(issue instanceof Error ? issue.message : "No se pudo cambiar el estado del asistente.");
    } finally {
      setActionBusy(false);
    }
  }

  function resetDemo() {
    setActionError("");
    try {
      setSuccess("Aviso final: se restableció toda la demo y se cerró la sesión.");
      demoService.resetAll();
      setResetOpen(false);
      globalThis.location.assign("/login?restablecida=1");
    } catch (issue) {
      setActionError("No se pudo restablecer la demo en este navegador. Intenta de nuevo.");
    }
  }

  return (
    <Layout titulo="Administración de accesos">
      {USE_AZURE ? <p className="admin-announcement">Las cuentas se administran en este navegador (demostración)</p> : null}
      {canViewServices ? (
        <AzureStatus
          enabled={USE_AZURE}
          health={azureHealth}
          loading={healthLoading}
          onRefresh={() => setHealthRetry((value) => value + 1)}
        />
      ) : null}
      {loading ? <p role="status">Cargando administración…</p> : null}
      {error ? (
        <div className="admin-error" role="alert">
          <p>{error}</p>
          <Button onClick={() => setRetry((current) => current + 1)}>Reintentar</Button>
        </div>
      ) : null}
      {actionError ? <p className="admin-error" role="alert">{actionError}</p> : null}
      <p className="admin-announcement" aria-live="polite">{success}</p>
      {summary && !error ? (
        <>
          <AdminSummaryBar summary={summary} />
          <AssistantControl
            enabled={assistantEnabled}
            busy={actionBusy}
            onToggle={handleAssistantToggle}
          />
          <div className="admin-toolbar">
            <div className="admin-tabs" role="tablist" aria-label="Administración" onKeyDown={handleTabKeyDown}>
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  id={`admin-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`admin-panel-${tab.id}`}
                  tabIndex={activeTab === tab.id ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <Button variant="secondary" onClick={() => setResetOpen(true)}>Restablecer toda la demo</Button>
          </div>

          <section
            id="admin-panel-accounts"
            role="tabpanel"
            aria-labelledby="admin-tab-accounts"
            tabIndex="0"
            hidden={activeTab !== "accounts"}
          >
            <AccountFilters
              filters={filters}
              roles={filterOptions.roles}
              branches={filterOptions.sucursales}
              onChange={changeFilters}
            />
            {accounts?.cuentas.length ? (
              <>
                <AccountTable
                  accounts={accounts.cuentas}
                  disableRules={disableRules}
                  onDisable={(account) => {
                    setDisableDialogError("");
                    setSelectedAccount(account);
                  }}
                  onEnable={handleEnable}
                />
                <AdminPagination
                  page={accounts.page}
                  totalPages={accounts.totalPages}
                  total={accounts.total}
                  pageSize={accounts.pageSize}
                  onChange={setPage}
                />
              </>
            ) : <p>No se encontraron cuentas.</p>}
          </section>

          <section
            id="admin-panel-roles"
            role="tabpanel"
            aria-labelledby="admin-tab-roles"
            tabIndex="0"
            hidden={activeTab !== "roles"}
          >
            {matrix ? <RoleMatrix matrix={matrix} /> : null}
          </section>

          <section
            id="admin-panel-audit"
            role="tabpanel"
            aria-labelledby="admin-tab-audit"
            tabIndex="0"
            hidden={activeTab !== "audit"}
          >
            <AuditLog entries={auditEntries} />
          </section>
        </>
      ) : null}
      <DisableAccountDialog
        account={selectedAccount}
        error={disableDialogError}
        onClose={() => {
          setSelectedAccount(null);
          setDisableDialogError("");
        }}
        onConfirm={disableAccount}
      />
      <DemoResetDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={resetDemo}
      />
    </Layout>
  );
}
