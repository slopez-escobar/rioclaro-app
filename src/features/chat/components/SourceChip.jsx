import { formatDateTime } from "../../../shared/utils/format.js";

function formatCutoff(value) {
  const date = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}:\d{2})/);
  return date ? `${Number(date[3])} ${new Intl.DateTimeFormat("es-MX", { month: "short" }).format(new Date(`${date[1]}-${date[2]}-01T00:00:00`)).replace(".", "")} ${date[1]} ${date[4]}` : value;
}

export default function SourceChip({ fuente }) {
  let label = "Catálogo";
  if (fuente.tipo === "politica") {
    label = `${fuente.id} · v${fuente.version} · ${fuente.titulo}`;
  } else if (fuente.tipo === "existencias") {
    label = `Existencias · ${formatCutoff(fuente.detalle?.replace(/^corte\s*/i, ""))}`;
  } else if (fuente.tipo === "pedido") {
    label = `Pedido ${fuente.id}`;
  } else if (fuente.tipo === "catalogo") {
    label = "Catálogo";
  }
  return <span className="chat-source">{label}</span>;
}
