---
id: POL-12
titulo: Inventario y existencias
version: "1.0"
vigente: true
vigente_desde: 2025-03-01
audiencia: interna
responsable: Antonio Gómez López (Jefe de bodega)
---
# Inventario y existencias

## Propósito
Mantener un solo catálogo y existencias confiables para que todos, incluido el asistente, den la misma respuesta.

## Alcance
Bodegas y almacenes de las cinco sucursales y todos los productos del catálogo.

## Reglas
- **Fuente única de verdad:** Existe un solo catálogo de 64 productos, con una clave por producto. Ninguna sucursal mantiene su propia lista con claves o nombres distintos.
- **Nombres alternos:** Los nombres que usaban las sucursales (por ejemplo, "CLORO LITRO" o "Blanqueador 1000ml") se registran como alias de la clave única.
- **Existencia y disponible:** Existencia es lo que hay físicamente. Disponible es la existencia menos lo comprometido en pedidos por surtir. A los clientes se les informa el disponible.
- **Conteos:** Cada producto se cuenta al menos una vez al mes. Se registra la fecha del último conteo.
- **Punto de reorden:** Se calcula para cubrir aproximadamente 7 días de demanda de la sucursal. Al llegar a él, bodega avisa a Compras.
- **Estatus de stock:** Agotado (disponible 0), bajo (disponible igual o menor al punto de reorden), normal y exceso (por encima del máximo).
- **Entre sucursales:** Un pedido puede surtirse desde otra sucursal. Se registra la sucursal que surte y se avisa al cliente.
- **Diferencias:** Si el conteo no coincide con el registro, se reporta al Jefe de bodega y se ajusta con su autorización.

## Procedimiento
1. Bodega recibe la mercancía y registra la entrada.
2. Se actualiza la existencia en el catálogo único.
3. Cada mes se hace el conteo y se compara con el registro.
4. Se atienden los productos bajos o agotados y se avisa a Compras.
5. Las diferencias se ajustan con autorización.
