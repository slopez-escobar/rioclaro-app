import { useEffect } from "react";

/** Actualiza el título de la pestaña para la pantalla activa. */
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = `${title} · Río Claro`;
  }, [title]);
}
