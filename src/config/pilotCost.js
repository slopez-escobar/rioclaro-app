export const PILOT_BUDGET = {
  creditoUSD: 99,
  alertaUSD: 20,
  gastoRealUsd: null,
  fechaCorte: null,
  fuente: "Azure Cost Management",
};

export const AZURE_SERVICES = [
  {
    nombre: "Azure Storage (sitio web estático)",
    justificacion: "Publica la aplicación web estática",
    estimadoUSD: null,
  },
  {
    nombre: "Azure Functions (Consumo) + Application Insights",
    justificacion: "Ejecuta la API bajo demanda y permite observar su rendimiento y errores",
    estimadoUSD: null,
  },
  {
    nombre: "Azure AI Document Intelligence",
    justificacion: "Leer facturas en PDF y foto es la meta (1) del director; sin esto la captura sigue siendo manual (12 h semanales y 1 error cada 20)",
    estimadoUSD: null,
  },
  {
    nombre: "Azure AI Foundry / Azure OpenAI (gpt-4.1-mini)",
    justificacion: "Es la meta (2): responder en minutos con lineamientos y herramientas",
    estimadoUSD: null,
  },
  {
    nombre: "Azure AI Language",
    justificacion: "Convierte las quejas en datos medibles y detecta casos repetidos",
    estimadoUSD: null,
  },
  {
    nombre: "Azure AI Speech",
    justificacion: "El backend emite el token de voz; la interfaz de voz queda como mejora",
    estimadoUSD: null,
  },
];
