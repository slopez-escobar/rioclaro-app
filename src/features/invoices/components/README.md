# Componentes de facturas

Componentes de presentación: reciben datos y callbacks por props; no acceden a `fetch` ni a `localStorage`.

- `UploadBox`: `{ onFiles(files), disabled, progress, errors }`. `progress` es `{ actual, total, archivo }`; `errors` acepta mensajes o `{ archivo, error }`.
- `StatusTag`: `{ estado }`.
- `ConfidenceValue`: `{ campo: { valor, confianza } | valor, formato? }`.
- `InvoiceTable`: `{ facturas, onSelect(factura), selectedId }`.
- `InvoiceDetail`: `{ factura, session, onClose(), onDecision(accion), onOpenOther(id) }`.
- `DecisionDialog`: `{ accion, factura, onConfirm(comentario), onCancel() }`.
- `SummaryBar`: `{ resumen }`, con los valores devueltos por `invoiceService.summary()`.

Los estilos compartidos de estos componentes están en `invoice-components.css`; el CSS se importa desde los componentes.
