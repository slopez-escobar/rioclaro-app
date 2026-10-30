import { Component } from "react";

export function ErrorFallback() {
  return (
    <main className="error-boundary" role="alert">
      <h1>Algo salió mal.</h1>
      <div className="error-boundary-actions">
        <button type="button" className="btn btn-secondary" onClick={() => globalThis.location.assign("/")}>
          Volver al inicio
        </button>
        <button type="button" className="btn btn-primary" onClick={() => globalThis.location.reload()}>
          Recargar la página
        </button>
      </div>
    </main>
  );
}

export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return <ErrorFallback />;
  }
}
