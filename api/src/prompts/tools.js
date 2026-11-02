import { can } from "../lib/permissions.js";

const definitions = [
  {
    name: "consultar_existencias",
    description: "Consulta las existencias disponibles de un producto.",
    properties: {
      producto: { type: "string", description: "Nombre o presentación del producto." },
      sucursal: { type: "string", description: "Sucursal en la que se consulta." },
    },
    required: ["producto"],
  },
  {
    name: "consultar_precio",
    description: "Consulta el precio vigente de un producto.",
    properties: {
      producto: { type: "string", description: "Nombre o presentación del producto." },
      idCliente: { type: "string", description: "Identificador del cliente." },
    },
    required: ["producto"],
  },
  {
    name: "estado_pedido",
    description: "Consulta el estado de un pedido.",
    properties: {
      referencia: {
        type: "string",
        description: "Folio RC-AAAA-NNNNNN, id PED-NNNNNN o en_curso.",
      },
    },
    required: ["referencia"],
  },
  {
    name: "buscar_politica",
    description: "Busca información en las políticas vigentes de Río Claro.",
    properties: { consulta: { type: "string", description: "Tema de la consulta." } },
    required: ["consulta"],
  },
  {
    name: "registrar_queja",
    description: "Registra una queja del usuario.",
    properties: {
      descripcion: { type: "string", description: "Descripción de la queja." },
      idPedido: { type: "string", description: "Identificador relacionado del pedido." },
      idCliente: { type: "string", description: "Identificador relacionado del cliente." },
    },
    required: ["descripcion"],
  },
];

export function getChatTools(rol) {
  const canCreateComplaints = can(rol, "quejas", "crear");
  return definitions
    .filter((definition) => canCreateComplaints
      || !["consultar_precio", "registrar_queja"].includes(definition.name))
    .map(({ name, description, properties, required }) => ({
      type: "function",
      function: {
        name,
        description,
        parameters: {
          type: "object",
          properties,
          required,
          additionalProperties: false,
        },
      },
    }));
}
