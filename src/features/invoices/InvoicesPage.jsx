import { useCallback, useEffect, useMemo, useState } from "react";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle.js";
import Button from "../../shared/ui/Button.jsx";
import Input from "../../shared/ui/Input.jsx";
import Layout from "../../shared/ui/Layout.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { can } from "../auth/permissions.js";
import InvoiceDetail from "./components/InvoiceDetail.jsx";
import InvoiceTable from "./components/InvoiceTable.jsx";
import SummaryBar from "./components/SummaryBar.jsx";
import UploadBox from "./components/UploadBox.jsx";
import DecisionDialog from "./components/DecisionDialog.jsx";
import { invoiceRepository } from "./invoiceRepository.js";
import { invoiceService } from "./invoiceService.js";
import "./invoices-page.css";

const FILTERS = [
  { id: "todas", label: "Todas" },
  { id: "revisar", label: "Por revisar" },
  { id: "duplicadas", label: "Duplicadas" },
  { id: "pendientes", label: "Pendientes de aprobar" },
  { id: "aprobadas", label: "Aprobadas" },
  { id: "rechazadas", label: "Rechazadas" },
];
const FINAL_STATES = new Set(["Aprobada", "Rechazada"]);

function valueOf(field) {
  return field !== null && typeof field === "object" && Object.hasOwn(field, "valor")
    ? field.valor
    : field;
}

function matchesFilter(invoice, filter) {
  switch (filter) {
    case "revisar":
      return invoice.estado === "Revisar";
    case "duplicadas":
      return invoice.estado === "Duplicada";
    case "pendientes":
      return ["OK", "Revisar"].includes(invoice.estado) && !FINAL_STATES.has(invoice.estado);
    case "aprobadas":
      return invoice.estado === "Aprobada";
    case "rechazadas":
      return invoice.estado === "Rechazada";
    default:
      return true;
  }
}

function matchesSearch(invoice, query) {
  if (!query) return true;
  return [
    valueOf(invoice.proveedor),
    valueOf(invoice.folio),
    invoice.archivo,
  ].some((value) => String(value ?? "").toLocaleLowerCase("es-MX").includes(query));
}

/**
 * Integra el flujo de facturas para personas autorizadas por el router.
 * @returns {import("react").JSX.Element} Pantalla de gestión de facturas.
 */
export default function InvoicesPage() {
  useDocumentTitle("Facturas");
  const { session } = useAuth();
  const canCreate = can(session?.rol, "facturas_proveedores", "crear");
  const [facturas, setFacturas] = useState([]);
  const [resumen, setResumen] = useState({});
  const [filter, setFilter] = useState("todas");
  const [search, setSearch] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [decisionAction, setDecisionAction] = useState(null);
  const [progress, setProgress] = useState(null);
  const [uploadErrors, setUploadErrors] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    setFacturas(invoiceRepository.list());
    setResumen(invoiceService.summary());
  }, []);

  useEffect(() => {
    try {
      refresh();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  }, [refresh]);

  const visibleInvoices = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es-MX");
    return facturas
      .filter((invoice) => matchesFilter(invoice, filter) && matchesSearch(invoice, query))
      .sort((first, second) =>
        String(second.subidaEn ?? "").localeCompare(String(first.subidaEn ?? "")),
      );
  }, [facturas, filter, search]);

  async function processFiles(files) {
    setProcessing(true);
    setProgress(null);
    setUploadErrors([]);
    setAnnouncement("");
    setError("");
    try {
      const result = await invoiceService.processFiles(files, session, setProgress);
      setUploadErrors(result.errores);
      refresh();
      setAnnouncement(
        `${result.creados.length} facturas procesadas, ${result.errores.length} con error.`,
      );
    } catch (processingError) {
      setError(processingError instanceof Error ? processingError.message : String(processingError));
    } finally {
      setProcessing(false);
      setProgress(null);
    }
  }

  async function loadSamples() {
    setProcessing(true);
    setProgress(null);
    setUploadErrors([]);
    setAnnouncement("");
    setError("");
    try {
      const result = await invoiceService.loadSampleInvoices(session, setProgress);
      setUploadErrors(result.errores);
      refresh();
      setAnnouncement(
        `${result.creados.length} facturas procesadas, ${result.errores.length} con error.`,
      );
    } catch (sampleError) {
      setError(sampleError instanceof Error ? sampleError.message : String(sampleError));
    } finally {
      setProcessing(false);
      setProgress(null);
    }
  }

  function resetDemo() {
    const confirmed = globalThis.confirm(
      "¿Restablecer la demo de facturas? Se eliminarán las facturas cargadas y decisiones de esta función.",
    );
    if (!confirmed) return;
    setError("");
    try {
      invoiceRepository.reset();
      refresh();
      setSelectedInvoice(null);
      setDecisionAction(null);
      setAnnouncement("La demo de facturas se restableció con las 9 facturas iniciales.");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : String(resetError));
    }
  }

  function openOtherInvoice(id) {
    const original = invoiceRepository.getById(id);
    if (!original) {
      setError("No se encontró la factura original.");
      return;
    }
    setSelectedInvoice(original);
  }

  function requestDecision(action) {
    setError("");
    setDecisionAction(action);
  }

  function confirmDecision(comment) {
    if (!selectedInvoice || !decisionAction) return;
    try {
      const updated = invoiceService.decide(
        selectedInvoice.id,
        { accion: decisionAction, comentario: comment },
        session,
      );
      refresh();
      setAnnouncement(`Factura ${updated.archivo}: decisión «${decisionAction}» registrada.`);
      setDecisionAction(null);
      setSelectedInvoice(null);
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : String(decisionError));
      setDecisionAction(null);
    }
  }

  return (
    <Layout titulo="Facturas de proveedores">
      <div className="facturas-page">
        <p className="facturas-human-review" role="note">
          La IA extrae; una persona decide antes de pagar.
        </p>

        <SummaryBar resumen={resumen} />

        {canCreate ? (
          <section className="facturas-upload-panel" aria-label="Carga de facturas">
            <UploadBox
              onFiles={processFiles}
              disabled={processing}
              progress={progress}
              errors={uploadErrors}
            />
            <Button type="button" variant="secondary" disabled={processing} onClick={loadSamples}>
              Cargar las facturas de prueba
            </Button>
          </section>
        ) : null}

        <section className="facturas-list-section" aria-label="Listado de facturas">
          <div className="facturas-list-header">
            <h2>Facturas registradas</h2>
            <Button type="button" variant="secondary" onClick={resetDemo}>
              Restablecer demo
            </Button>
          </div>

          <div className="facturas-filters" aria-label="Filtros de facturas">
            <div className="facturas-filter-chips" role="group" aria-label="Filtrar por estado">
              {FILTERS.map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  variant={filter === item.id ? "primary" : "secondary"}
                  aria-pressed={filter === item.id}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
            <Input
              label="Buscar proveedor, folio o archivo"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Escribe para buscar"
            />
          </div>

          <InvoiceTable
            facturas={visibleInvoices}
            selectedId={selectedInvoice?.id}
            onSelect={setSelectedInvoice}
          />
        </section>

        <InvoiceDetail
          factura={selectedInvoice}
          session={session}
          onClose={() => setSelectedInvoice(null)}
          onDecision={requestDecision}
          onOpenOther={openOtherInvoice}
        />
        <DecisionDialog
          accion={decisionAction}
          factura={selectedInvoice}
          onConfirm={confirmDecision}
          onCancel={() => setDecisionAction(null)}
        />

        {announcement ? (
          <p className="facturas-announcement" role="status" aria-live="polite">
            {announcement}
          </p>
        ) : null}
        {error ? <p className="facturas-error" role="alert">{error}</p> : null}
      </div>
    </Layout>
  );
}
