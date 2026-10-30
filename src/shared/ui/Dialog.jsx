import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not(:disabled)",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Diálogo modal accesible con restauración y contención del foco.
 * @param {Object} props Estado, título accesible, contenido y cierre.
 * @returns {import("react").JSX.Element|null} Diálogo abierto o cerrado.
 */
export default function Dialog({
  open,
  onClose,
  labelledBy,
  className = "",
  dirty = false,
  children,
}) {
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return undefined;
    returnFocusRef.current = document.activeElement;
    if (!dialog.open) dialog.showModal();
    const initialFocus = dialog.querySelector("[data-autofocus]")
      || dialog.querySelector("input, textarea, select, button");
    (initialFocus || dialog).focus();

    return () => {
      if (dialog.open) dialog.close();
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
    };
  }, [open]);

  if (!open) return null;

  function close() {
    onClose?.();
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...dialogRef.current.querySelectorAll(FOCUSABLE)]
      .filter((element) => element.getClientRects().length > 0);
    if (!focusable.length) {
      event.preventDefault();
      dialogRef.current.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={className}
      aria-modal="true"
      aria-labelledby={labelledBy}
      tabIndex={-1}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onKeyDown={handleKeyDown}
      onClick={(event) => {
        if (event.target === event.currentTarget && !dirty) close();
      }}
    >
      {children}
    </dialog>
  );
}
