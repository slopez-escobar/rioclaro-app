import { useId } from "react";

export default function Input({ label, error, id, ...props }) {
  const auto = useId();
  const inputId = id || auto;
  return (
    <div className="campo">
      <label htmlFor={inputId}>{label}</label>
      <input id={inputId} aria-invalid={error ? "true" : undefined} aria-describedby={error ? `${inputId}-error` : undefined} {...props} />
      {error ? <p id={`${inputId}-error`} className="error" role="alert">{error}</p> : null}
    </div>
  );
}
