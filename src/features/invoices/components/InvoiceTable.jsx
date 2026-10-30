import { formatDate, formatMXN } from "../../../shared/utils/format.js";
import { pendingApprovals, requiredApprovals } from "../domain/invoiceDecisions.js";
import { invoiceFieldValue } from "./presentation.js";
import StatusTag from "./StatusTag.jsx";
import "./invoice-components.css";

const ROLE_LABELS = { finanzas: "Finanzas", direccion: "Dirección" };

function approvalSummary(invoice) {
  const roles = requiredApprovals(invoiceFieldValue(invoice.total));
  const pending = pendingApprovals(invoice);
  return roles.map((role) =>
    `${ROLE_LABELS[role]} ${pending.includes(role) ? "pendiente" : "✓"}`,
  ).join(" · ");
}

function openSelected(event, invoice, onSelect) {
  if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
  if (event.type === "keydown") event.preventDefault();
  onSelect?.(invoice);
}

/**
 * Presenta la lista de facturas en una tabla adaptable y seleccionable.
 * @param {Object} props Facturas y callbacks de selección.
 * @returns {import("react").JSX.Element} Tabla de facturas.
 */
export default function InvoiceTable({ facturas = [], onSelect, selectedId }) {
  if (facturas.length === 0) {
    return <p className="factura-empty">Aún no hay facturas. Sube la primera.</p>;
  }

  return (
    <div className="factura-table-scroll" role="region" aria-label="Facturas registradas" tabIndex={0}>
      <table className="factura-table">
        <caption>Facturas de proveedores. Selecciona una fila para ver sus detalles.</caption>
        <thead>
          <tr>
            <th scope="col">Archivo</th>
            <th scope="col">Proveedor</th>
            <th scope="col">RFC</th>
            <th scope="col">Folio</th>
            <th scope="col">Fecha</th>
            <th scope="col">Total</th>
            <th scope="col">Estado</th>
            <th scope="col">Aprobaciones</th>
          </tr>
        </thead>
        <tbody>
          {facturas.map((invoice) => (
            <tr
              key={invoice.id}
              className="factura-row"
              tabIndex={0}
              aria-selected={selectedId === invoice.id}
              onClick={(event) => openSelected(event, invoice, onSelect)}
              onKeyDown={(event) => openSelected(event, invoice, onSelect)}
            >
              <td>{invoice.archivo || "—"}</td>
              <td>{invoiceFieldValue(invoice.proveedor) || "—"}</td>
              <td>{invoiceFieldValue(invoice.rfc) || "—"}</td>
              <td>{invoiceFieldValue(invoice.folio) || "—"}</td>
              <td>{formatDate(invoiceFieldValue(invoice.fecha))}</td>
              <td>{formatMXN(invoiceFieldValue(invoice.total))}</td>
              <td><StatusTag estado={invoice.estado} /></td>
              <td>{approvalSummary(invoice)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
