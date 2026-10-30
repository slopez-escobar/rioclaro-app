import { useEffect, useMemo, useState } from "react";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle.js";
import { useAuth } from "../auth/AuthContext.jsx";
import Button from "../../shared/ui/Button.jsx";
import Layout from "../../shared/ui/Layout.jsx";
import { filterOrders } from "./domain/orderFilters.js";
import { getOrderDetail, getOrdersData } from "./orderService.js";
import OrderDetail from "./components/OrderDetail.jsx";
import OrderFilters from "./components/OrderFilters.jsx";
import OrdersPagination from "./components/OrdersPagination.jsx";
import OrdersTable from "./components/OrdersTable.jsx";
import OrderSummary from "./components/OrderSummary.jsx";
import "./orders.css";

const PAGE_SIZE = 25;
const INITIAL_FILTERS = {
  estado: "",
  desde: "",
  hasta: "",
  tipoEntrega: "",
  idSucursal: "",
  texto: "",
};

export default function OrdersPage() {
  useDocumentTitle("Pedidos");
  const { session } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getOrdersData(session)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((cause) => {
        if (active) setError("No fue posible cargar los pedidos.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [session, retry]);

  const filteredOrders = useMemo(() => {
    if (!data) return [];
    return filterOrders(data.orders, filters)
      .sort((left, right) => String(right.fechaPedido).localeCompare(String(left.fechaPedido)));
  }, [data, filters]);
  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const visibleOrders = filteredOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const showBranchFilter = session?.alcance === "todas";

  function changeFilters(next) {
    setFilters(next);
    setPage(1);
  }

  async function openOrder(id) {
    setDetailError("");
    try {
      const order = await getOrderDetail(session, id);
      if (!order) {
        setDetailError("No se encontró el pedido o está fuera de tu alcance.");
        return;
      }
      setSelectedOrder(order);
    } catch (cause) {
      setDetailError("No fue posible abrir el detalle del pedido.");
    }
  }

  return (
    <Layout titulo="Pedidos">
      {error ? (
        <div className="pedidos-error" role="alert">
          <p>{error}</p>
          <Button onClick={() => setRetry((current) => current + 1)}>Reintentar</Button>
        </div>
      ) : null}
      {detailError ? <p className="pedidos-error" role="alert">{detailError}</p> : null}

      {loading ? <p className="pedidos-loading" role="status">Cargando pedidos…</p> : null}
      {!loading && !error && data ? (
        <>
          <OrderSummary summary={data.summary} />
          <OrderFilters
            filters={filters}
            onChange={changeFilters}
            sucursales={data.sucursales}
            estados={data.estados}
            mostrarSucursal={showBranchFilter}
          />
          <OrdersPagination
            page={page}
            pageCount={pageCount}
            total={filteredOrders.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
          <OrdersTable
            orders={visibleOrders}
            onSelect={openOrder}
            selectedId={selectedOrder?.idPedido}
          />
          <OrdersPagination
            page={page}
            pageCount={pageCount}
            total={filteredOrders.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
          <OrderDetail order={selectedOrder} onClose={() => setSelectedOrder(null)} />
        </>
      ) : null}
    </Layout>
  );
}
