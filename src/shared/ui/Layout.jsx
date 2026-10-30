import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthContext.jsx";
import { can } from "../../features/auth/permissions.js";
import { empresa, SUCURSALES_POR_ID } from "../../config/sucursales.js";
import Button from "./Button.jsx";

const ENLACES = [
  { to: "/panel", texto: "Panel", modulo: "reporte_ventas", accion: "ver" },
  { to: "/facturas", texto: "Facturas", modulo: "facturas_proveedores", accion: "ver" },
  { to: "/pedidos", texto: "Pedidos", modulo: "pedidos", accion: "ver" },
  { to: "/ventas", texto: "Ventas", modulo: "reporte_ventas", accion: "ver" },
  { to: "/admin", texto: "Administración", modulo: "usuarios_y_accesos", accion: "ver" },
  { to: "/politicas", texto: "Políticas" },
  { to: "/quejas", texto: "Quejas", modulo: "quejas", accion: "ver" },
  { to: "/existencias", texto: "Existencias", modulo: "existencias", accion: "ver" },
  { to: "/catalogo", texto: "Catálogo", modulo: "existencias", accion: "ver" },
  { to: "/asistente", texto: "Asistente", modulo: "asistente_ia", accion: "usar" },
  { to: "/ia-responsable", texto: "IA responsable" },
];

export default function Layout({ titulo, children }) {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const salir = () => { logout(); navigate("/login", { replace: true }); };
  const sucursal = session ? SUCURSALES_POR_ID[session.idSucursal]?.nombre : "";
  return (
    <div className="app-shell">
      <header className="encabezado">
        <strong className="marca" aria-label={empresa.nombre}>
          <span className="marca-icono" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="23" height="23" fill="none">
              <path d="M8.5 3.5h5l1 2h4v2h-5l-1-2h-3v2h-2v-3l1-1Z" fill="currentColor" />
              <path d="M10 8h6v3l3 2v7H6v-7l4-2V8Z" fill="currentColor" />
              <path d="M9 16h7M18.5 4.5l.5-1.5.5 1.5L21 5l-1.5.5L19 7l-.5-1.5L17 5l1.5-.5Z" stroke="#183b2b" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" />
            </svg>
          </span>
          {empresa.nombre}
        </strong>
        <nav aria-label="Principal">
          {ENLACES.filter((e) => !e.modulo || (session && can(session.rol, e.modulo, e.accion))).map((e) => (
            <NavLink key={e.to} to={e.to}>{e.texto}</NavLink>
          ))}
        </nav>
        <span className="usuario">
          <span className="usuario-nombre">
            {session ? [session.nombre, session.puesto, sucursal].filter(Boolean).join(" · ") : ""}
          </span>
          <Button variant="ghost" onClick={salir}>Salir</Button>
        </span>
      </header>
      <main className="contenido">
        {titulo ? <h1>{titulo}</h1> : null}
        {children}
      </main>
    </div>
  );
}
