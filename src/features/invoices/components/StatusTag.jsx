import Tag from "../../../shared/ui/Tag.jsx";
import "./invoice-components.css";

const STATUSES = {
  OK: { variant: "ok", symbol: "✓" },
  Revisar: { variant: "revisar", symbol: "!" },
  Duplicada: { variant: "duplicada", symbol: "⧉" },
  Aprobada: { variant: "aprobada", symbol: "✓" },
  Rechazada: { variant: "rechazada", symbol: "✕" },
};

/**
 * Presenta el estado de una factura con símbolo y color.
 * @param {{estado: string}} props Estado de la factura.
 * @returns {import("react").JSX.Element} Etiqueta accesible.
 */
export default function StatusTag({ estado }) {
  const status = STATUSES[estado] ?? { variant: "info", symbol: "•" };
  return (
    <Tag variant={status.variant}>
      <span aria-hidden="true">{status.symbol} </span>
      {estado || "Sin estado"}
    </Tag>
  );
}
