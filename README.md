# Río Claro · Prototipo AI-901

Aplicación local de demostración para Distribuidora Río Claro. Usa React 19, Vite 8 y React Router 7, con un backend Azure Functions en `api/` y sin base de datos. Los cambios de la demo se guardan en el almacenamiento local del navegador.

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
| `npm run api:probar` | Ejecuta pruebas HTTP de humo contra la API local. |
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

## Calibración por RFC y confianza

La confianza de Document Intelligence representa su estimación sobre la lectura, no garantiza que el valor sea correcto. El proveedor se valida únicamente cuando el RFC leído existe en el catálogo: en ese caso se ignoran las confianzas del nombre y del RFC y se muestra la `razonSocial` del catálogo. Si el RFC falta o no está registrado, la factura queda en revisión con un motivo explícito. Los datos requeridos deben estar presentes; folio, fecha y total también deben alcanzar sus umbrales. Estas reglas son de prototipo y no sustituyen la revisión humana.

| Campo | Validación |
|---|---|
| Proveedor y RFC | RFC asociado al catálogo; sin umbral de confianza |
| Folio | 60% |
| Fecha | 80% |
| Total | 90% |

| Lectura real | Resultado de Document Intelligence | Resultado de validación |
|---|---|---|
| `FACTURA 8841 (1).pdf` (limpia) | Proveedor `CY` (82%); RFC `CDO920402DFT` (72.3%); folio `A-8841` (79.8%); fecha `2026-10-06` (98.3%); total `$10,750.76` (98.2%). | Válida si el RFC está en el catálogo; se muestra la razón social catalogada. |
| `20261016_091523.jpg` (foto de la misma factura) | Proveedor `CY` (73.8%); RFC `CDO920402DFT` (82.1%); folio `A-8841` (68.3%); fecha 97.9%; total `$10,750.76` (97.6%). | Duplicada del PDF por RFC, folio y total. |
| `factura_urgente.jpg` (borrosa) | Proveedor leído como “Plásticos Soptodos Baje S. de R.L. de C.V.” (99.5%); sin RFC, folio, fecha ni total. | En revisión; un nombre de alta confianza no valida al proveedor ni sustituye los datos faltantes. |

El folio, por ser un código corto, tuvo menor confianza que los demás campos de la factura limpia; por eso tiene un mínimo de 60%. El total, por ser dinero, requiere 90%. La pantalla de IA responsable registra la validación por RFC y la lectura borrosa en CS-7; incluye 23 verificaciones (20 locales, 2 pendientes en Azure y 1 manual).

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
- No hay base de datos ni persistencia compartida; la API de demostración procesa sesiones en memoria y llama a Azure solo cuando el recurso está configurado.
- Las contraseñas de demostración están en el paquete local y el backend para facilitar pruebas. No uses estas cuentas en producción.
- Las cuentas desactivadas, la auditoría, el chat y los cambios de facturas/quejas son locales a este navegador.
- El restablecimiento global elimina exclusivamente las claves con prefijo `rc:v1:`. Los datos fuente y las copias base no se modifican.
- Antes de producción, la autenticación y la autorización deben migrarse a un servicio de identidad; los datos personales requieren un backend autorizado.

## Backend (`api/`)

La API usa Azure Functions v4 y Node.js 20 o posterior. Instala sus dependencias desde el directorio independiente:

```bash
cd api
npm install
```

Copia `api/local.settings.example.json` como `api/local.settings.json` y configura un `TOKEN_SECRET` aleatorio de al menos 32 caracteres. Para iniciar localmente, instala Azure Functions Core Tools por separado si hace falta y ejecuta desde `api/`:

```bash
func start
```

La configuración local se mantiene fuera del control de versiones. La API ofrece salud, inicio de sesión, extracción de facturas, chat, análisis de quejas y token de voz; llama a Azure solo cuando los servicios están configurados y no requiere una base de datos.
