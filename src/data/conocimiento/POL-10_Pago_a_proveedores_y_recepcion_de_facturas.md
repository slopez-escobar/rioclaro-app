---
id: POL-10
titulo: Pago a proveedores y recepción de facturas
version: "1.0"
vigente: true
vigente_desde: 2024-06-01
audiencia: interna
responsable: Sandra Castro García (Contador general)
---
# Pago a proveedores y recepción de facturas

## Propósito
Evitar errores y pagos duplicados al recibir, registrar y pagar las facturas de proveedores.

## Alcance
Todas las facturas de los proveedores de la empresa, sin importar la sucursal que las reciba.

## Reglas
- **Buzón único:** Las facturas se reciben solo en facturas-proveedores@rioclaro.example. Está prohibido recibirlas en correos personales o por WhatsApp.
- **Formato:** Se prefiere PDF o XML. La foto se acepta solo si el proveedor no puede enviar otro formato.
- **Nombre del archivo:** RFC del proveedor_folio_fecha (AAAA-MM-DD). Por ejemplo: ENX920204L7M_A1234_2026-10-15.pdf.
- **Proveedor registrado:** El RFC y la razón social de la factura deben existir en el catálogo de proveedores. Si no, no se paga y se avisa a Compras.
- **Lectura automática:** La IA extrae proveedor, RFC, folio, fecha y total. Si la confianza de un campo es menor al mínimo de ese campo (total 90%; fecha 80%; folio 60%), o falta algún dato, la factura pasa a revisión manual. El proveedor se identifica por su RFC, no por el nombre leído: si el RFC coincide con un proveedor del catálogo, queda validado por el catálogo aunque el nombre leído sea distinto o la confianza de lectura del RFC sea baja; si el RFC no está en el catálogo, el proveedor y el RFC exigen 80% y la factura pasa a revisión.
- **Duplicados:** Una factura con el mismo proveedor, folio y total que otra se bloquea hasta que una persona decida. Aplica aunque una venga en PDF y otra en foto.
- **Recepción de mercancía:** El comprador asignado confirma que la mercancía llegó antes de aprobar el pago.
- **Aprobación:** Finanzas aprueba cada factura. Pagos mayores a $100,000.00 requieren también la aprobación de Dirección.
- **Calendario de pagos:** Los pagos se programan los jueves, por transferencia y según los días de crédito del proveedor.

## Procedimiento
1. Finanzas recibe la factura en el buzón único y la nombra con el formato estándar.
2. Se procesa con lectura automática y se revisan los casos dudosos o duplicados.
3. El comprador confirma la recepción de la mercancía.
4. Finanzas aprueba; Dirección aprueba si el monto lo requiere.
5. Se programa el pago para el jueves y se archiva la factura.
