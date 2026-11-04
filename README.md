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
| `npm run dev:azure` | Inicia Vite con `.env.azure` y proxy a Azure Functions local. |
| `npm run build:azure` | Compila el modo Azure en `dist-azure/`. |
| `npm run verificar:azure` | Busca datos sensibles y confirma la configuración del paquete Azure. |

## Modo Azure

El archivo versionado `.env.azure` activa `VITE_USE_AZURE=true` y configura la URL de producción `VITE_API_BASE_URL`. En desarrollo, `npm run dev:azure` usa `/api` y Vite reenvía esa ruta a `http://localhost:7071`; en el build Azure el cliente usa la URL HTTPS absoluta de la Function App. Para compilar y revisar el paquete ejecuta `npm run build:azure` y `npm run verificar:azure`.

En este modo el login, la lectura de facturas, el análisis de sentimiento y el chat usan el backend. El listado de quejas y sus indicadores usan una estimación léxica local etiquetada como `estimado`; no llaman a Azure AI Language. El análisis remoto se solicita una sola vez al registrar una queja nueva o al abrir el detalle de una queja aún no analizada. Las solicitudes se cachean en memoria y se ejecutan de una en una. Para el chat, `gpt-4.1-mini` decide si necesita una herramienta; la aplicación ejecuta las cinco herramientas con la sesión y el alcance del usuario y devuelve al modelo solo el resultado mínimo permitido. Los datos completos de existencias, pedidos y políticas no se envían al backend. Las negativas locales de privacidad e inyección se resuelven antes de cualquier llamada al modelo, incluso si Azure no está disponible. La aplicación no envía mensajes de sistema ni metadatos de interfaz; el backend agrega su instrucción de sistema y el modelo solo ve lo que cada herramienta devuelve. Las cuentas desactivadas y su panel permanecen locales a este navegador; el login remoto no consulta esa lista. Los datos de negocio continúan incluidos en el paquete de la aplicación. El paquete Azure excluye las contraseñas de demostración.

## Despliegue

La arquitectura usa un sitio web estático en Azure Storage (`https://strioclaroweb.z14.web.core.windows.net`) y una Function App independiente (`https://rioclaro-api-sle-e4c6brcsbkdkd7h0.belgiumcentral-01.azurewebsites.net`). En la configuración de sitio web estático de Azure Storage, establece `index.html` como documento de error para resolver las rutas de la SPA. El frontend llama directamente a la API; no hay Static Web Apps ni proxy en producción.

La API corre en Azure Functions en plan de Consumo con Application Insights. El piloto utiliza Azure AI Document Intelligence, Azure AI Foundry / Azure OpenAI (`gpt-4.1-mini`), Azure AI Language y Azure AI Speech; el backend emite el token de voz, mientras que la interfaz de voz queda como mejora. Key Vault es una mejora recomendada para producción.

El gasto real y la fecha de corte del piloto se capturan en `src/config/pilotCost.js` (`gastoRealUsd` y `fechaCorte`); mientras sus valores sean `null`, el panel muestra “Pendiente de capturar”.

El workflow `.github/workflows/deploy.yml` valida el repositorio y despliega el contenedor `$web` y la Function App `rioclaro-api-sle` en los pushes a `main` y al iniciarlo manualmente. Configura estos secretos de GitHub Actions:

```text
AZURE_STORAGE_CONNECTION_STRING
AZURE_FUNCTIONAPP_PUBLISH_PROFILE
```

La Function App es Windows Consumption con Functions v4 y Node.js 22. Configura `WEBSITE_NODE_DEFAULT_VERSION` como `~22` en la Function App; define además estas variables de aplicación con los mismos nombres de `api/local.settings.json` y almacena sus valores solo en Azure:

```text
FUNCTIONS_WORKER_RUNTIME
AzureWebJobsStorage
TOKEN_SECRET
TOKEN_TTL_HOURS
ASSISTANT_ENABLED
RECEPTOR_RFC
DOCINT_ENDPOINT
DOCINT_KEY
DOCINT_API_VERSION
AOAI_ENDPOINT
AOAI_KEY
AOAI_DEPLOYMENT
AOAI_API_VERSION
LANGUAGE_ENDPOINT
LANGUAGE_KEY
LANGUAGE_API_VERSION
SPEECH_REGION
SPEECH_KEY
```

En la configuración de CORS de la Function App, permite el origen exacto `https://strioclaroweb.z14.web.core.windows.net` (sin `/` final). Azure App Service/Functions procesa las solicitudes preflight `OPTIONS`; no agregues ese origen al código de los handlers. Las funciones declaran `GET` o `POST`, y la plataforma debe contestar el preflight antes de invocarlas.

El workflow sube los archivos del build al contenedor `$web` con Azure CLI y establece explícitamente el tipo MIME de cada archivo según su extensión. Después publica `api/` con el perfil de publicación; `.funcignore` excluye archivos locales, pruebas y documentación, pero conserva `node_modules` con las dependencias de producción instaladas por el workflow.

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

El folio, por ser un código corto, tuvo menor confianza que los demás campos de la factura limpia; por eso tiene un mínimo de 60%. El total, por ser dinero, requiere 90%. La pantalla de IA responsable registra la validación por RFC y la lectura borrosa en CS-7; incluye 24 verificaciones (21 locales, 2 pendientes en Azure y 1 manual).

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
- Las contraseñas de demostración están disponibles únicamente en el modo local y en el backend de pruebas. No uses estas cuentas en producción.
- Las cuentas desactivadas, la auditoría, el chat y los cambios de facturas/quejas son locales a este navegador.
- El restablecimiento global elimina exclusivamente las claves con prefijo `rc:v1:`. Los datos fuente y las copias base no se modifican.
- Antes de producción, la autenticación y la autorización deben migrarse a un servicio de identidad; los datos personales requieren un backend autorizado.

## Backend (`api/`)

La API usa Azure Functions v4 y Node.js 22 o posterior. Instala sus dependencias desde el directorio independiente:

```bash
cd api
npm install
```

Copia `api/local.settings.example.json` como `api/local.settings.json` y configura un `TOKEN_SECRET` aleatorio de al menos 32 caracteres. Para iniciar localmente, instala Azure Functions Core Tools por separado si hace falta y ejecuta desde `api/`:

```bash
func start
```

La configuración local se mantiene fuera del control de versiones. La API ofrece salud, inicio de sesión, extracción de facturas, chat, análisis de quejas y token de voz; llama a Azure solo cuando los servicios están configurados y no requiere una base de datos.
