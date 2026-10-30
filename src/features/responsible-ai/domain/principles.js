export const PRINCIPLES = [
  {
    id: "equidad",
    nombre: "Equidad",
    pregunta: "¿El agente trata igual a clientes de todas las sucursales, o favorece a la que tenía más y mejores datos?",
    queHace: [
      { texto: "Resuelve existencias y precios con los mismos servicios para las cinco sucursales.", ruta: "/existencias" },
      { texto: "Muestra la disponibilidad y el corte de inventario de forma consistente.", ruta: "/asistente" },
      { texto: "Usa una política vigente y común para responder sobre devoluciones.", ruta: "/politicas" },
    ],
  },
  {
    id: "confiabilidad",
    nombre: "Confiabilidad y seguridad",
    pregunta: "¿Qué pasa si una factura está borrosa? ¿El sistema la marca para revisión humana en lugar de inventar un total?",
    queHace: [
      { texto: "Marca campos de baja confianza o proveedores no registrados para revisión.", ruta: "/facturas" },
      { texto: "Detecta duplicados por contenido y por datos de factura.", ruta: "/facturas" },
      { texto: "El asistente rechaza instrucciones que intentan manipular sus reglas.", ruta: "/asistente" },
      { texto: "El interruptor administrativo detiene las respuestas del asistente.", ruta: "/admin" },
    ],
  },
  {
    id: "privacidad",
    nombre: "Privacidad y seguridad",
    pregunta: "¿Las nóminas, precios y datos de clientes quedan protegidos con Entra ID y Key Vault? ¿Se evita enviar datos sensibles innecesarios al modelo?",
    queHace: [
      { texto: "El asistente rechaza solicitudes de nómina y datos de otros clientes.", ruta: "/asistente" },
      { texto: "Los repositorios limitan pedidos y clientes al alcance de la sesión.", ruta: "/pedidos" },
      { texto: "Los clientes solo pueden consultar políticas públicas.", ruta: "/politicas" },
      { texto: "El directorio omite nómina, RFC y otros campos personales sensibles.", ruta: "/admin" },
    ],
  },
  {
    id: "inclusion",
    nombre: "Inclusión",
    pregunta: "¿El asistente funciona por voz y desde el celular para el personal de bodega?",
    queHace: [
      { texto: "La interfaz del asistente se puede usar desde pantallas pequeñas.", ruta: "/asistente" },
      { texto: "La integración de voz con Azure AI Speech se valida en el paso B6.", ruta: "/ia-responsable" },
      { texto: "Las pantallas operativas cuentan con controles de teclado y foco visible.", ruta: "/existencias" },
    ],
  },
  {
    id: "transparencia",
    nombre: "Transparencia",
    pregunta: "¿El usuario sabe que habla con una IA y de qué documento salió cada respuesta?",
    queHace: [
      { texto: "El asistente presenta un aviso visible de inteligencia artificial.", ruta: "/asistente" },
      { texto: "Las respuestas basadas en políticas citan identificador, título y versión.", ruta: "/politicas" },
      { texto: "Las respuestas de productos, existencias y pedidos incluyen sus fuentes.", ruta: "/asistente" },
    ],
  },
  {
    id: "rendicion",
    nombre: "Rendición de cuentas",
    pregunta: "¿Quién en la empresa revisa y aprueba lo que sugiere la IA, por ejemplo, antes de pagar una factura?",
    queHace: [
      { texto: "Las facturas requieren aprobación humana y conservan historial de decisiones.", ruta: "/facturas" },
      { texto: "Las facturas mayores a $100,000 requieren aprobación de Dirección además de Finanzas.", ruta: "/facturas" },
      { texto: "Las acciones de administración quedan registradas en auditoría.", ruta: "/admin" },
    ],
  },
];
