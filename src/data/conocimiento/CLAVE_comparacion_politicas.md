# Clave de comparación: las 3 políticas de devoluciones

> Solo para quien evalúa el escenario. No forma parte de lo que ven las sucursales.

| Archivo | Versión interna | Fecha | Elaboró | Aplica a |
|---|---|---|---|---|
| `Politica_Devoluciones_FINAL` | 1.0 | Marzo 2018 | Ernesto Ramírez Villaseñor (Director general) | Todas las sucursales |
| `Politica_Devoluciones_Leon_NUEVA` | Sin número | Septiembre 2022 | Mariana Torres Aguilar (Gerente León) | León y Zapopan (pendiente confirmar Querétaro y Aguascalientes) |
| `Politica_Devoluciones_2024_v3` | 3.0 | Vigente desde 01/06/2024 | Sandra Castro García (Contador general); autorizó Ernesto Ramírez Villaseñor | Las 5 sucursales |

Los nombres de archivo confunden a propósito: el que dice "FINAL" es el más antiguo y el que dice "NUEVA" no es el más reciente.

## Contradicciones

| Tema | v1 (2018) | León (2022) | v3 (2024) |
|---|---|---|---|
| Plazo | 30 días naturales | 8 días naturales | **15 días naturales** |
| Estado del producto | Buen estado; se acepta abierto si hay defecto | Sellado y sin usar | **Sellado y en su empaque original** |
| Reporte de daños | 7 días | 24 horas | **48 horas, con fotografía** |
| Quién autoriza | El vendedor hasta $2,000 + IVA; más, el gerente | Solo el gerente de sucursal | **El gerente de sucursal** |
| Compensación | Efectivo o transferencia en 5 días hábiles | Solo nota de crédito, nunca efectivo | **Nota de crédito o reposición; reembolso solo si no hay existencia** |
| Cargo por manejo | Ninguno | 10% si no es falla de Río Claro | **Ninguno** |
| Flete de recolección | Lo paga el cliente | Lo paga Río Claro | **Río Claro si la falla es suya; el cliente si el error fue de su pedido** |
| No retornables | No se especifican | Garrafas de 20 litros y químicos trasvasados | **Higiene personal (guantes, cubrebocas, gel)** |
| Sucursales | Todas | León y Zapopan | **Las 5** |

## Versión que se propone como vigente

La **v3.0 (2024)**: es la más reciente, la única que aplica a las 5 sucursales y la única con control de versiones, y es la que ya usa `politica-devoluciones.md` en la base de conocimiento del chat. La unificación consiste en conservar solo esa y documentar el cambio en `ENTREGA.md` ("de tres versiones a una").

## Congruencia con los demás archivos

- Los nombres (Ernesto Ramírez Villaseñor, Mariana Torres Aguilar, Sandra Castro García) salen de `empleados.json`.
- Los teléfonos salen de `sucursales.json`.
- Que autorice el gerente de sucursal coincide con las funciones del puesto en `puestos-y-roles.json`.
- Los motivos de devolución de `pedidos.json` (producto dañado, equivocado, caducado) caben en las reglas de las 3 versiones.
