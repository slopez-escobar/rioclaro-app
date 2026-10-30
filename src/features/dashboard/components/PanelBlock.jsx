import { Link } from "react-router-dom";

export default function PanelBlock({ title, block, detailLinks = [], children }) {
  const isReady = block?.estado === "ok";
  return (
    <section className="panel-block" aria-labelledby={`panel-${title}`}>
      <h2 id={`panel-${title}`}>{title}</h2>
      {isReady
        ? children
        : (
          <p className={block?.estado === "error" ? "panel-error" : "panel-no-access"}
            role={block?.estado === "error" ? "alert" : undefined}>
            {block?.mensaje || "No se pudo cargar este bloque."}
          </p>
        )}
      <footer className="panel-block-footer">
        <span>Fuente: {block?.fuente || "No disponible"}</span>
        {isReady && detailLinks.some((item) => item.canOpen) ? (
          <nav aria-label={`Detalles de ${title}`}>
            {detailLinks.filter((item) => item.canOpen).map((item) => (
              <Link key={item.to} to={item.to}>Ver detalle: {item.label}</Link>
            ))}
          </nav>
        ) : null}
      </footer>
    </section>
  );
}
