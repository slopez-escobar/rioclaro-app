# Componentes de facturas

Componentes de presentación: reciben datos y callbacks por props; no acceden a `fetch` ni a `localStorage`.

- `UploadBox`: `{ onFiles(files), disabled, progress, errors }`. `progress` es `{ actual, total, archivo }`; `errors` acepta mensajes o `{ archivo, error }`.
- `StatusTag`: `{ estado }`.
- `ConfidenceValue`: `{ campo: { valor, confianza } | valor, field, formato?, validadoPorCatalogo? }`; muestra la razón social del catálogo para proveedor y el indicador “Validado por catálogo” en proveedor/RFC validados, sin advertencia por confianza. En otros campos marca confianza baja según el umbral e informa el mínimo en el `title`.
- `InvoiceTable`: `{ facturas, onSelect(factura), selectedId }`.
- `InvoiceDetail`: `{ factura, session, onClose(), onDecision(accion), onOpenOther(id) }`.
- `DecisionDialog`: `{ accion, factura, onConfirm(comentario), onCancel() }`.
- `SummaryBar`: `{ resumen }`, con los valores devueltos por `invoiceService.summary()`.

Los estilos compartidos de estos componentes están en `invoice-components.css`; el CSS se importa desde los componentes.
