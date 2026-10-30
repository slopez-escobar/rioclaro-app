export const PILOT_BUDGET = {
  creditoUSD: 99,
  alertaUSD: 20,
  gastoRealUSD: null,
  fuente: "Azure Cost Management (se captura en el paso B7)",
};

export const AZURE_SERVICES = [
  {
    nombre: "Static Web Apps (Free)",
    justificacion: "Hospeda el front y el backend en un solo recurso, sin servidor que administrar",
    estimadoUSD: null,
  },
  {
    nombre: "Document Intelligence",
    justificacion: "Leer facturas en PDF y foto es la meta (1) del director; sin esto la captura sigue siendo manual (12 h semanales y 1 error cada 20)",
    estimadoUSD: null,
  },
  {
    nombre: "Foundry / Azure OpenAI (modelo mini)",
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
    justificacion: "Toño resuelve todo por teléfono y por voz",
    estimadoUSD: null,
  },
  {
    nombre: "Key Vault",
    justificacion: "Guarda llaves fuera del código (privacidad) y apoya a Carlos",
    estimadoUSD: null,
  },
];
