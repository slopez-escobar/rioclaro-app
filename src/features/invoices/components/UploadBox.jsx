import { useRef, useState } from "react";
import Button from "../../../shared/ui/Button.jsx";
import "./invoice-components.css";

function normalizeErrors(errors) {
  if (!Array.isArray(errors)) return [];
  return errors.map((error) =>
    typeof error === "string"
      ? error
      : [error?.archivo, error?.error].filter(Boolean).join(": "),
  ).filter(Boolean);
}

/**
 * Permite seleccionar o soltar archivos de factura y muestra el progreso.
 * @param {Object} props Callback de selección, estado deshabilitado y resultados.
 * @returns {import("react").JSX.Element} Zona de carga.
 */
export default function UploadBox({ onFiles, disabled = false, progress, errors = [] }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const messages = normalizeErrors(errors);

  function sendFiles(fileList) {
    const files = Array.from(fileList ?? []);
    if (files.length && !disabled) onFiles?.(files);
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    sendFiles(event.dataTransfer.files);
  }

  return (
    <section className="factura-carga" aria-label="Carga de facturas">
      <div
        className={`factura-dropzone${dragging ? " activa" : ""}`}
        role="group"
        aria-disabled={disabled}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false);
        }}
        onDrop={handleDrop}
      >
        <p className="factura-upload-copy">Arrastra aquí tus facturas (PDF, JPG o PNG)</p>
        <input
          ref={inputRef}
          className="factura-upload-input"
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png"
          disabled={disabled}
          aria-label="Elegir archivos de factura"
          onChange={(event) => {
            sendFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          Elegir facturas
        </Button>
      </div>
      <div>
        <p className="factura-upload-progress" aria-live="polite" aria-atomic="true">
          {progress
            ? `Procesando ${progress.actual} de ${progress.total}: ${progress.archivo}`
            : ""}
        </p>
        {messages.length > 0 ? (
          <div aria-live="polite" aria-atomic="true">
            <h3>Archivos con error</h3>
            <ul className="factura-upload-errors">
              {messages.map((message, index) => <li key={`${index}-${message}`}>{message}</li>)}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
