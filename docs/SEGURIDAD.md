# Seguridad y privacidad

## Arquitectura actual

- Los secretos de los servicios y la clave de firma del token de sesión se configuran como variables de la Function App; los secretos necesarios para CI/CD se guardan en GitHub Secrets.
- El login emite un token firmado y las funciones de negocio validan la sesión antes de procesar solicitudes.
- Los permisos se aplican por rol y módulo. Los rechazos de privacidad del asistente son deterministas en la aplicación y no dependen de la respuesta del modelo.
- El login limita los intentos por usuario e IP. El contador actual vive en memoria por instancia; debe sustituirse por almacenamiento compartido antes de escalar en producción.
- Los logs de la API se limitan a metadatos operativos; no deben incluir cuerpos, mensajes, archivos, encabezados ni credenciales.

## Resultados de la auditoría

El comando `npm run auditar:seguridad` actualiza automáticamente esta tabla. La auditoría no imprime valores de secretos.

<!-- SECURITY_AUDIT_RESULTS_START -->
Resultados más recientes: 2026-11-03.

| Comprobación | Resultado | Detalle |
|---|---|---|
| Secretos en archivos versionados | OK | sin hallazgos |
| Secretos y datos sensibles en dist-azure | OK | sin hallazgos |
| Historial Git de configuración local | OK | ninguno de esos archivos aparece en el historial disponible. |
| .gitignore y .env.azure | OK | .gitignore completo y .env.azure contiene solo las dos variables permitidas, sin patrones de secreto. |
| Registros de la API | OK | api/src/handlers/chat.js:134 (metadatos permitidos); api/src/lib/endpoint.js:14 (metadatos permitidos) |
| Autenticación, roles, límites y health | OK | extractInvoice, chat, analyzeComplaint y speechToken exigen sesión/rol; login limita intentos; health solo expone indicadores booleanos y metadatos. |
| Privacidad IA responsable (PS-*) | OK | 6/6 comprobaciones locales PS-* aprobadas. |
<!-- SECURITY_AUDIT_RESULTS_END -->

## Excepciones conocidas del prototipo

- Las cuentas de demostración usan una contraseña conocida (`demo123`) y solo sirven para el prototipo; no son credenciales de producción. Los archivos `usuarios.json` de demostración quedan excluidos del detector de secretos en archivos versionados, de forma explícita.
- Parte de la sesión y preferencias se guarda en `localStorage` del navegador. No debe usarse como almacén autoritativo ni para secretos.
- El paquete del prototipo incluye datos de negocio de demostración. La auditoría impide publicar claves salariales, referencias a `../data` y el padrón personal/salarial, pero no sustituye un filtrado de datos en el servidor.

## Mejoras antes de producción

1. Guardar secretos en Key Vault y acceder con identidad administrada, sin claves persistentes en configuración cuando exista autenticación sin clave.
2. Sustituir cuentas locales por Microsoft Entra ID y políticas de acceso corporativas.
3. Aplicar filtrado y autorización de datos exclusivamente en el backend antes de responder o invocar servicios de IA.
4. Sustituir los datos y almacenes del prototipo por una base de datos con controles de acceso, auditoría, retención y respaldo.
5. Migrar los límites de intentos a un almacén compartido para que sean efectivos entre instancias de Functions.
