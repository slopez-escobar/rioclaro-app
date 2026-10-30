import Button from "../../../shared/ui/Button.jsx";

export default function InventoryPagination({ page, pageCount, total, pageSize, onChange }) {
  const first = total ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(page * pageSize, total);
  return (
    <nav className="inventory-pagination" aria-label="Paginación de existencias">
      <p aria-live="polite">
        {total ? `Mostrando ${first}–${last} de ${total} productos` : "0 productos"}
      </p>
      <div>
        <Button
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Página anterior"
        >
          Anterior
        </Button>
        <span>Página {page} de {pageCount}</span>
        <Button
          variant="secondary"
          disabled={page >= pageCount}
          onClick={() => onChange(page + 1)}
          aria-label="Página siguiente"
        >
          Siguiente
        </Button>
      </div>
    </nav>
  );
}
