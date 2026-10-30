import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle.js";
import { useAuth } from "./AuthContext.jsx";
import { CUENTAS_DEMO } from "./authService.js";
import { landingPath } from "./permissions.js";
import { empresa } from "../../config/sucursales.js";
import Input from "../../shared/ui/Input.jsx";
import Button from "../../shared/ui/Button.jsx";
import DemoResetDialog from "../../shared/ui/DemoResetDialog.jsx";
import { demoService } from "../demo/demoService.js";

export default function LoginPage() {
  useDocumentTitle("Inicio de sesión");
  const { session, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [resetNotice, setResetNotice] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetError, setResetError] = useState("");

  useEffect(() => {
    if (searchParams.get("restablecida") !== "1") return;
    setResetNotice("La demo se restableció y tu sesión se cerró.");
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  if (session) return <Navigate to={landingPath(session.rol)} replace />;

  const entrar = (u, p) => {
    const r = login(u, p);
    if (!r.ok) return setError(r.error);
    navigate(landingPath(r.session.rol), { replace: true });
  };

  const resetDemo = () => {
    setResetError("");
    try {
      demoService.resetAll();
      globalThis.location.assign("/login");
    } catch {
      setResetError("No se pudo restablecer la demo en este navegador. Intenta de nuevo.");
    }
  };

  return (
    <main className="login">
      <section className="login-marca" aria-label={empresa.nombre}>
        <div className="login-logotipo">
          <span className="marca-icono" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none">
              <path d="M8.5 3.5h5l1 2h4v2h-5l-1-2h-3v2h-2v-3l1-1Z" fill="currentColor" />
              <path d="M10 8h6v3l3 2v7H6v-7l4-2V8Z" fill="currentColor" />
              <path d="M9 16h7M18.5 4.5l.5-1.5.5 1.5L21 5l-1.5.5L19 7l-.5-1.5L17 5l1.5-.5Z" stroke="#183b2b" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" />
            </svg>
          </span>
          {empresa.nombre}
        </div>
        <div className="login-mensaje">
          <p className="login-kicker">Limpieza que inspira confianza</p>
          <h1>Bienestar en cada espacio.</h1>
          <p>Productos de limpieza e higiene para hogares, negocios y espacios que merecen lo mejor.</p>
        </div>
        <p className="login-pie">Calidad y frescura para cada día.</p>
      </section>
      <section className="login-formulario" aria-labelledby="login-titulo">
        <h2 id="login-titulo">Te damos la bienvenida</h2>
        <p className="login-intro">Ingresa a tu espacio de trabajo.</p>
        {resetNotice ? <p role="status">{resetNotice}</p> : null}
        <form onSubmit={(e) => { e.preventDefault(); entrar(usuario, password); }} noValidate>
          <Input label="Usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" />
          <Input label="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" error={error} />
          <Button type="submit">Entrar</Button>
        </form>
        <details className="demo">
          <summary>Cuentas de demostración</summary>
          <ul>
            {CUENTAS_DEMO.map((c) => (
              <li key={c.usuario}>
                <Button variant="secondary" onClick={() => entrar(c.usuario, c.password)}>
                  {c.nombre} · {c.detalle}
                </Button>
              </li>
            ))}
          </ul>
        </details>
        <button
          type="button"
          className="demo-reset-link"
          onClick={() => {
            setResetError("");
            setResetOpen(true);
          }}
        >
          ¿Algo salió raro? Restablecer la demo
        </button>
        {resetError ? <p role="alert" className="error">{resetError}</p> : null}
        <DemoResetDialog
          open={resetOpen}
          onClose={() => setResetOpen(false)}
          onConfirm={resetDemo}
        />
      </section>
    </main>
  );
}
