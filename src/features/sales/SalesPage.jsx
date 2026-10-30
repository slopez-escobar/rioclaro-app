import { useEffect, useState } from "react";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle.js";
import Button from "../../shared/ui/Button.jsx";
import Layout from "../../shared/ui/Layout.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { salesService } from "./salesService.js";
import BeforeAfterPanel from "./components/BeforeAfterPanel.jsx";
import BranchSalesTable from "./components/BranchSalesTable.jsx";
import CustomerSegmentSales from "./components/CustomerSegmentSales.jsx";
import MonthlySales from "./components/MonthlySales.jsx";
import ProductSalesTable from "./components/ProductSalesTable.jsx";
import ReconciliationBadge from "./components/ReconciliationBadge.jsx";
import SalesControls from "./components/SalesControls.jsx";
import SalesKpiBar from "./components/SalesKpiBar.jsx";
import SurteMatrix from "./components/SurteMatrix.jsx";
import "./sales.css";

export default function SalesPage() {
  useDocumentTitle("Ventas");
  const { session } = useAuth();
  const [periodo, setPeriodo] = useState("");
  const [idSucursal, setIdSucursal] = useState("");
  const [report, setReport] = useState(null);
  const [conciliacion, setConciliacion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const esUnaSucursal = session?.alcance === "sucursal";

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      salesService.getReport(session, { periodo, idSucursal }),
      salesService.getReconciliation(session),
    ]).then(([salesReport, salesReconciliation]) => {
      if (!active) return;
      setReport(salesReport);
      setConciliacion(salesReconciliation);
    }).catch((cause) => {
      if (active) setError("No fue posible cargar el reporte de ventas.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [session, periodo, idSucursal, retry]);

  function changeControls(next) {
    setPeriodo(next.periodo);
    setIdSucursal(next.idSucursal);
  }

  const selectedBranch = idSucursal
    ? report?.sucursales.find((branch) => branch.id === idSucursal)
    : null;
  const badgeLabel = esUnaSucursal
    ? "Ventas de tu sucursal"
    : selectedBranch
      ? `Ventas de ${selectedBranch.ciudad || selectedBranch.nombre}`
      : undefined;
  const filteredReconciliation = esUnaSucursal || idSucursal
    ? {
      sumaSucursalesIgualTotal: true,
      diferencias: [],
    }
    : report?.reconciliacion;

  return (
    <Layout titulo="Ventas">
      <p className="sales-notice">
        Venta = importe de productos sin IVA, sin pedidos cancelados ni devueltos.
        {" "}Las 5 sucursales se miden con la misma regla.
      </p>
      {error ? (
        <div className="sales-error" role="alert">
          <p>{error}</p>
          <Button onClick={() => setRetry((current) => current + 1)}>Reintentar</Button>
        </div>
      ) : null}
      {loading ? <p className="sales-loading" role="status">Cargando ventas…</p> : null}
      {!loading && !error && report ? (
        report.totales.netas.pedidos === 0 ? (
          <p className="sales-empty" role="alert">No hay ventas para los filtros seleccionados.</p>
        ) : (
          <div className="sales-content" aria-busy={loading}>
            <SalesControls
              periodos={report.periodosDisponibles}
              periodo={periodo}
              idSucursal={idSucursal}
              onChange={changeControls}
              mostrarSucursal={session?.alcance === "todas"}
              sucursales={report.sucursales}
            />
            <SalesKpiBar totales={report.totales} />
            <ReconciliationBadge
              reconciliacion={filteredReconciliation}
              esUnaSucursal={esUnaSucursal || Boolean(idSucursal)}
              textoUnaSucursal={badgeLabel}
            />
            <BranchSalesTable
              porSucursal={report.porSucursal}
              sucursales={report.sucursales}
              totalGeneral={report.totales.netas.productos}
            />
            <SurteMatrix
              matriz={report.matriz}
              sucursales={report.sucursales}
              fueraDeSucursal={report.fueraDeSucursal}
              surtidasParaOtras={report.surtidasParaOtras}
              esUnaSucursal={esUnaSucursal}
            />
            <ProductSalesTable porProducto={report.porProducto} />
            <MonthlySales porMes={report.porMes} />
            <CustomerSegmentSales
              porTipoCliente={report.porTipoCliente}
              porTamano={report.porTamano}
            />
            <BeforeAfterPanel
              conciliacion={conciliacion}
              esUnaSucursal={esUnaSucursal}
            />
          </div>
        )
      ) : null}
    </Layout>
  );
}
