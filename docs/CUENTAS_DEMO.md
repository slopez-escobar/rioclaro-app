# Cuentas de demostración

Estas credenciales solo sirven para el prototipo local. No son un mecanismo de autenticación seguro.

**Contraseña de demostración:** demo123

## Personajes del caso

| Usuario | Nombre | Puesto | Rol | Sucursal |
|---|---|---|---|---|
| ernesto | Ernesto Ramírez | Director general | Dirección | Río Claro Guadalajara |
| laura | Laura Hernández | Analista de cuentas por pagar | Finanzas | Río Claro Guadalajara |
| mariana | Mariana Torres | Gerente de sucursal | Gerente de sucursal | Río Claro León |
| tono | Antonio Gómez | Jefe de bodega | Bodega | Río Claro Guadalajara |
| carlos | Carlos Medina | Soporte y sistemas | Administrador de TI | Río Claro Guadalajara |

## Un ejemplo de cuenta por cada rol

| Rol | Usuario de ejemplo | Alcance | Pantallas permitidas | No puede ver |
|---|---|---|---|---|
| Dirección (`direccion`) | ernesto | todas | IA responsable, Panel, Políticas, Asistente, Facturas, Pedidos, Ventas, Quejas, Existencias, Catálogo | Administración |
| Finanzas (`finanzas`) | sandra.castro | todas | IA responsable, Panel, Políticas, Asistente, Facturas, Pedidos, Ventas | Administración, Quejas, Existencias, Catálogo |
| Compras (`compras`) | enrique.palacios | todas | IA responsable, Políticas, Asistente, Facturas, Existencias, Catálogo | Panel, Administración, Pedidos, Ventas, Quejas |
| Recursos humanos (`rh`) | leticia.castro | todas | IA responsable, Políticas, Asistente | Panel, Administración, Facturas, Pedidos, Ventas, Quejas, Existencias, Catálogo |
| Administrador de TI (`administrador_ti`) | carlos | todas | IA responsable, Administración, Políticas, Asistente | Panel, Facturas, Pedidos, Ventas, Quejas, Existencias, Catálogo |
| Gerente de sucursal (`gerente_sucursal`) | javier.vargas | sucursal | IA responsable, Panel, Políticas, Asistente, Pedidos, Ventas, Quejas, Existencias, Catálogo | Administración, Facturas |
| Ventas y atención a clientes (`ventas`) | carmen.ramos | sucursal | IA responsable, Políticas, Asistente, Pedidos, Quejas, Existencias, Catálogo | Panel, Administración, Facturas, Ventas |
| Bodega (`bodega`) | tono | sucursal | IA responsable, Políticas, Asistente, Pedidos, Existencias, Catálogo | Panel, Administración, Facturas, Ventas, Quejas |
| Reparto (`reparto`) | diana.barajas | sucursal | IA responsable, Políticas, Asistente, Pedidos | Panel, Administración, Facturas, Ventas, Quejas, Existencias, Catálogo |
| Administrativo (`administrativo`) | karla.camacho | sucursal | IA responsable, Políticas, Asistente, Pedidos | Panel, Administración, Facturas, Ventas, Quejas, Existencias, Catálogo |
| Cliente externo (`cliente`) | cliente1 | propio | IA responsable, Políticas, Asistente, Pedidos | Panel, Administración, Facturas, Ventas, Quejas, Existencias, Catálogo |

## Clientes de demostración

| Usuario | Cliente | Sucursal | Tamaño |
|---|---|---|---|
| cliente1 | Hotel Alameda | Río Claro Guadalajara | grande |
| cliente2 | Pollería El Molino | Río Claro Guadalajara | mediano |
| cliente3 | Depósito Los Ángeles Ciudad Granja | Río Claro Zapopan | grande |
| cliente4 | Cremería y Abarrotes El Rosario Ciudad Granja | Río Claro Zapopan | pequeño |
| cliente5 | Instituto Simón Bolívar | Río Claro León | grande |
| cliente6 | Universidad Montessori Aurora | Río Claro León | pequeño |
| cliente7 | Hotel Santa Fe Histórico | Río Claro Querétaro | grande |
| cliente8 | Tendajón Mi Tiendita El Pueblito | Río Claro Querétaro | pequeño |
| cliente9 | Fonda La Casona Trojes de Alonso | Río Claro Aguascalientes | grande |
| cliente10 | Tienda El Arenal Jardines de la Concepción | Río Claro Aguascalientes | pequeño |

El alcance `todas` incluye todas las sucursales; `sucursal` limita la consulta a la sucursal asignada; `propio` limita los datos de pedidos y quejas al cliente de la sesión.
