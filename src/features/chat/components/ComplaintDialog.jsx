import { useEffect, useRef, useState } from "react";
import Input from "../../../shared/ui/Input.jsx";
import Button from "../../../shared/ui/Button.jsx";

export default function ComplaintDialog({
  open,
  session,
  orders = [],
  onLoadOrders,
  onClose,
  onSubmit,
}) {
  const dialogRef = useRef(null);
  const previousFocus = useRef(null);
  const [description, setDescription] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [orderOptions, setOrderOptions] = useState(orders);
  const [error, setError] = useState("");
  const [loadingOrders, setLoadingOrders] = useState(false);
  const isCustomer = session?.rol === "cliente";
  const loadOrders = async (targetSession, targetCustomerId) => {
    if (!onLoadOrders) return;
    setLoadingOrders(true);
    setError("");
    try {
      const loaded = await onLoadOrders(targetSession, targetCustomerId);
      setOrderOptions(loaded || []);
    } catch (issue) {
      setError(issue.message || "No se pudieron cargar los pedidos.");
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    if (open && !dialog.open) {
      previousFocus.current = document.activeElement;
      dialog.showModal();
      dialog.querySelector("textarea, input, select")?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    setDescription("");
    setCustomerId("");
    setOrderId("");
    setOrderOptions(orders);
    setError("");
    if (isCustomer) loadOrders(session, session.idCliente);
    return undefined;
  // El diálogo solicita los pedidos solo al abrirse y al cambiar el cliente.
  }, [open]);

  const descriptionError = description.length > 0 && description.trim().length < 15
    ? "La descripción debe tener al menos 15 caracteres"
    : "";
  const submit = async (event) => {
    event.preventDefault();
    if (description.trim().length < 15) {
      setError("La descripción debe tener al menos 15 caracteres");
      return;
    }
    if (!isCustomer && !customerId.trim()) {
      setError("Escribe el ID del cliente.");
      return;
    }
    try {
      await onSubmit({
        descripcion: description,
        idCliente: isCustomer ? session.idCliente : customerId.trim(),
        idPedido: orderId || null,
      });
      onClose();
      previousFocus.current?.focus?.();
    } catch (issue) {
      setError(issue.message || "No se pudo registrar la queja.");
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="chat-dialog"
      aria-labelledby="complaint-dialog-title"
      onCancel={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      onClose={() => previousFocus.current?.focus?.()}
    >
      <form onSubmit={submit}>
        <div className="chat-dialog-header">
          <h2 id="complaint-dialog-title">Registrar mi queja</h2>
          <button type="button" className="chat-dialog-close" aria-label="Cerrar" onClick={onClose}>×</button>
        </div>
        {!isCustomer ? (
          <Input
            label="ID del cliente"
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            onBlur={() => {
              if (customerId.trim()) loadOrders(session, customerId.trim());
            }}
            placeholder="Ej. CLI-0001"
            required
          />
        ) : null}
        <div className="campo">
          <label htmlFor="complaint-description">Describe lo ocurrido</label>
          <textarea
            id="complaint-description"
            rows={5}
            value={description}
            maxLength={1000}
            onChange={(event) => setDescription(event.target.value)}
            aria-invalid={Boolean(descriptionError)}
            aria-describedby="complaint-description-count"
          />
          <p id="complaint-description-count" className={descriptionError ? "error" : "chat-count"}>
            {description.length}/1000 caracteres · mínimo 15
          </p>
          {descriptionError ? <p className="error" role="alert">{descriptionError}</p> : null}
        </div>
        {isCustomer || customerId.trim() ? (
          <div className="campo">
            <label htmlFor="complaint-order">Pedido relacionado (opcional)</label>
            <select id="complaint-order" value={orderId} onChange={(event) => setOrderId(event.target.value)} disabled={loadingOrders}>
              <option value="">Sin pedido relacionado</option>
              {orderOptions.map((order) => (
                <option key={order.idPedido} value={order.idPedido}>{order.folio} · {order.estado.replaceAll("_", " ")}</option>
              ))}
            </select>
            {loadingOrders ? <span>Cargando tus pedidos…</span> : null}
          </div>
        ) : null}
        {error ? <p className="error" role="alert">{error}</p> : null}
        <div className="chat-dialog-actions">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit">Registrar queja</Button>
        </div>
      </form>
    </dialog>
  );
}
