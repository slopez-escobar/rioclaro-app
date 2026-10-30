import Button from "../../../shared/ui/Button.jsx";

export default function OrdersPagination({ page, pageCount, total, pageSize, onPageChange }) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return (
    <nav className="pedidos-pagination" aria-label="Paginación de pedidos">
      <p aria-live="polite">
        {total ? `Mostrando ${first}–${last} de ${total.toLocaleString("es-MX")} pedidos` : "0 pedidos"}
      </p>
      <div>
        <Button
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Página anterior"
        >
          Anterior
        </Button>
        <span>Página {page} de {pageCount}</span>
        <Button
          variant="secondary"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          aria-label="Página siguiente"
        >
          Siguiente
        </Button>
      </div>
    </nav>
  );
}
