import Button from "../../../shared/ui/Button.jsx";

export default function AdminPagination({ page, totalPages, total, pageSize, onChange }) {
  const first = total ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(page * pageSize, total);
  return (
    <nav className="admin-pagination" aria-label="Paginación de cuentas">
      <p aria-live="polite">
        {total ? `Mostrando ${first}–${last} de ${total} cuentas` : "0 cuentas"}
      </p>
      <div>
        <Button
          variant="secondary"
          disabled={page <= 1}
          aria-label="Página anterior"
          onClick={() => onChange(page - 1)}
        >
          Anterior
        </Button>
        <span>Página {page} de {totalPages}</span>
        <Button
          variant="secondary"
          disabled={page >= totalPages}
          aria-label="Página siguiente"
          onClick={() => onChange(page + 1)}
        >
          Siguiente
        </Button>
      </div>
    </nav>
  );
}
