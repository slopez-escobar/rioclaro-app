# Río Claro · Prototipo AI-901

Aplicación local de demostración para Distribuidora Río Claro. Usa React 19, Vite 8 y React Router 7; no tiene base de datos ni backend. Los cambios de la demo se guardan en el almacenamiento local del navegador.

## Requisitos e inicio

Se requiere Node.js 24 o posterior.

```bash
npm install
npm run datos
npm run dev
```

Abre la dirección local que indique Vite. El proyecto está pensado para ejecutarse junto a su carpeta hermana `data/`; no muevas la carpeta de datos dentro de la aplicación.

## Comandos

| Comando | Uso |
|---|---|
| `npm run datos` | Genera las copias seguras de datos necesarias para la app. |
| `npm run datos:check` | Comprueba que las copias generadas coincidan con `data/`. |
| `npm run catalogo:unificar` | Regenera el catálogo unificado desde los archivos de sucursales. |
| `npm run catalogo:check` | Comprueba la vigencia de la unificación del catálogo. |
| `npm run ventas:conciliar` | Regenera la conciliación de reportes de venta. |
| `npm run ventas:check` | Comprueba la vigencia de la conciliación. |
| `npm run docs:cuentas` | Genera `docs/CUENTAS_DEMO.md` a partir de las cuentas, roles y datos publicados. |
| `npm test` | Ejecuta las pruebas con Vitest. |
| `npm run build` | Compila la app en `dist/`. |

## Datos y estructura

La fuente de datos de negocio está en la carpeta hermana `data/`. `npm run datos` prepara copias versionadas en `src/data/source/`, las políticas vigentes en `src/data/conocimiento/`, las cuentas locales de demostración en `src/features/auth/data/` y los archivos de prueba publicados en `public/facturas-prueba/`. La app se puede compilar y desplegar usando estas copias sin incluir toda la carpeta fuente.

El script excluye del directorio de empleados los datos personales y salariales que no necesita la interfaz. No importes `data/Empleados/RioClaro_Empleados.json` al cliente. Las credenciales de demostración permanecen en el paquete local únicamente para probar el flujo; no son autenticación de producción.

```text
rioclaro-app/
├── public/                 Recursos estáticos y facturas de prueba
├── scripts/                Generación, conciliación y validación de datos
├── src/
│   ├── app/                Router y composición de la aplicación
│   ├── config/             Configuración local de la demo
│   ├── data/               Repositorios y copias seguras generadas
│   ├── features/           Pantallas, servicios y reglas de negocio
│   ├── shared/             UI, almacenamiento, hooks y utilidades
│   └── styles/             Estilos globales
├── tests/                  Pruebas de servicios, permisos y seguridad
└── docs/                   Documentación del prototipo y sus cuentas
```

## Cuentas de demostración

La contraseña local de demostración es `demo123`. El inicio presenta accesos rápidos para Ernesto, Laura, Mariana, Toño, Carlos y `cliente1`. La lista por rol, el alcance de cada cuenta, las pantallas permitidas y las diez cuentas cliente se generan en [docs/CUENTAS_DEMO.md](./docs/CUENTAS_DEMO.md).

## Pantallas y permisos

Las rutas requieren sesión salvo `/login`. Los permisos se leen del catálogo `rolesApp` de los roles del proyecto; las rutas desconocidas redirigen a la pantalla inicial del rol.

| Pantalla | Ruta | Permiso |
|---|---|---|
| Facturas de proveedores | `/facturas` | `facturas_proveedores.ver` |
| Asistente | `/asistente` | `asistente_ia.usar` |
| Quejas | `/quejas` | `quejas.ver` |
| Pedidos | `/pedidos` | `pedidos.ver` |
| Existencias | `/existencias` | `existencias.ver` |
| Catálogo unificado | `/catalogo` | `existencias.ver` |
| Ventas | `/ventas` | `reporte_ventas.ver` |
| Panel de dirección | `/panel` | `reporte_ventas.ver` |
| Administración | `/admin` | `usuarios_y_accesos.ver` |
| Políticas | `/politicas` | Sesión |
| IA responsable | `/ia-responsable` | Sesión |

## Límites del prototipo

- Los datos operativos y cambios de demo viven en el navegador; borrar los datos del sitio los elimina.
- No hay base de datos, sincronización entre personas ni backend autorizado.
- Las contraseñas de demostración están en el paquete local para facilitar pruebas. No uses estas cuentas en producción.
- Las cuentas desactivadas, la auditoría, el chat y los cambios de facturas/quejas son locales a este navegador.
- El restablecimiento global elimina exclusivamente las claves con prefijo `rc:v1:`. Los datos fuente y las copias base no se modifican.
- Antes de producción, la autenticación y la autorización deben migrarse a un servicio de identidad; los datos personales requieren un backend autorizado.
