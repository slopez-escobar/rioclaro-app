# API de Río Claro

Base local de Azure Functions v4, Node.js 22 o posterior. Instala y ejecuta desde esta carpeta:

```bash
npm install
func start
```

Copia `local.settings.example.json` como `local.settings.json`, genera un secreto aleatorio para `TOKEN_SECRET` (mínimo 32 caracteres) y no lo compartas ni lo incluyas en el repositorio. `api/local.settings.json` está excluido por el `.gitignore` raíz. `AzureWebJobsStorage` usa el emulador Azurite en desarrollo; para una cuenta local, cambia ese valor por su cadena de conexión.

En el portal de Azure, configura las variables como ajustes de aplicación de la Function App. Obtén `DOCINT_ENDPOINT` y `DOCINT_KEY` en **Document Intelligence > Claves y punto de conexión**; `AOAI_ENDPOINT` y `AOAI_KEY` en **Azure OpenAI/Foundry > Claves y punto de conexión**, y `AOAI_DEPLOYMENT` del nombre del despliegue de modelo; `LANGUAGE_ENDPOINT` y `LANGUAGE_KEY` en **Language > Claves y punto de conexión**; `SPEECH_REGION` y `SPEECH_KEY` en **Speech > Claves y punto de conexión**. Las variables `*_API_VERSION` son versiones de API, no secretos. `TOKEN_TTL_HOURS`, `ASSISTANT_ENABLED` y `RECEPTOR_RFC` son valores de configuración de la aplicación.

Los endpoints llaman a los recursos Azure configurados con `fetch` nativo, sin SDK adicional. Las banderas de `/api/health` solo indican si cada bloque de configuración está completo.

La etapa B2.2 agrega `/api/extractInvoice`, `/api/chat`, `/api/analyzeComplaint` y `/api/speechToken`; requieren una sesión emitida por `/api/login`. El script `npm run api:probar` ejecuta la comprobación HTTP de humo desde la raíz del proyecto y omite los servicios Azure que estén sin configurar.
