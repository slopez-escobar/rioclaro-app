import { useEffect, useState } from "react";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle.js";
import Button from "../../shared/ui/Button.jsx";
import Layout from "../../shared/ui/Layout.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import InventoryDetail from "./components/InventoryDetail.jsx";
import InventoryFilters from "./components/InventoryFilters.jsx";
import InventoryPagination from "./components/InventoryPagination.jsx";
import InventorySummaryBar from "./components/InventorySummaryBar.jsx";
import InventoryTable from "./components/InventoryTable.jsx";
import { inventoryService } from "./inventoryService.js";
import "./inventory.css";

const PAGE_SIZE = 20;
const INITIAL_FILTERS = {
  texto: "",
  categoria: "",
  estatus: "",
  idSucursal: "",
};

export default function InventoryPage() {
  useDocumentTitle("Existencias");
  const { session } = useAuth();
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [summary, setSummary] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      inventoryService.list(session, filters, { page, pageSize: PAGE_SIZE }),
      inventoryService.summary(session),
    ]).then(([listResult, summaryResult]) => {
      if (!active) return;
      setResult(listResult);
      setSummary(summaryResult);
    }).catch((cause) => {
      if (active) setError("No fue posible cargar las existencias.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [session, filters, page, retry]);

  function changeFilters(nextFilters) {
    setFilters(nextFilters);
    setPage(1);
  }

  async function openProduct(key) {
    try {
      const product = await inventoryService.getProduct(session, key);
      if (!product) {
        setError("No se encontró el producto dentro de tu alcance.");
        return;
      }
      setSelectedProduct(product);
    } catch (cause) {
      setError("No fue posible abrir el detalle del producto.");
    }
  }

  return (
    <Layout titulo="Existencias">
      <p className="inventory-notice">
        A los clientes se les informa el disponible (POL-12).
      </p>
      {error ? (
        <div className="inventory-error" role="alert">
          <p>{error}</p>
          <Button onClick={() => setRetry((current) => current + 1)}>Reintentar</Button>
        </div>
      ) : null}
      {loading ? <p className="inventory-loading" role="status">Cargando existencias…</p> : null}
      {!error && result && summary ? (
        <div className="inventory-content" aria-busy={loading}>
          {loading ? <span className="inventory-updating" role="status">Actualizando resultados…</span> : null}
          <InventorySummaryBar summary={summary} />
          <InventoryFilters
            filtros={filters}
            onChange={changeFilters}
            categorias={result.categorias}
            sucursales={result.sucursales}
            mostrarSucursal={result.alcance === "todas"}
          />
          <InventoryPagination
            page={result.page}
            pageCount={result.pageCount}
            total={result.total}
            pageSize={result.pageSize}
            onChange={setPage}
          />
          <InventoryTable
            filas={result.filas}
            alcance={result.alcance}
            sucursales={result.sucursales}
            onSelect={openProduct}
          />
          <InventoryPagination
            page={result.page}
            pageCount={result.pageCount}
            total={result.total}
            pageSize={result.pageSize}
            onChange={setPage}
          />
          <InventoryDetail
            producto={selectedProduct}
            onClose={() => setSelectedProduct(null)}
          />
        </div>
      ) : null}
    </Layout>
  );
}
