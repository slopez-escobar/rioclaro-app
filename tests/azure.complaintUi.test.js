import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ComplaintDetail from "../src/features/complaints/components/ComplaintDetail.jsx";
import ComplaintTable from "../src/features/complaints/components/ComplaintTable.jsx";

const complaint = {
  idQueja: "QJA-TEST",
  folio: "QJ-2026-0001",
  fechaQueja: "2026-10-26T10:00:00",
  clienteNombre: "Cliente de prueba",
  idCliente: "CLI-1",
  tema: "sin_clasificar",
  prioridad: "media",
  estatus: "abierta",
  sentimiento: { sentimiento: "sin_analizar", confianza: 0, frasesClave: [], origen: "no_disponible" },
  primeraRespuesta: { estado: "en_tiempo", minutos: 1 },
  accionesPermitidas: {},
  respuestas: [],
  descripcion: "La entrega llegó tarde y solicito apoyo.",
  folioPedido: "PED-1",
  idSucursal: "gdl",
  montoPedidoMXN: 120,
  canal: "web",
  casoRepetido: false,
  quejasRelacionadas: [],
};

describe("presentación de sentimiento no disponible", () => {
  it("muestra una etiqueta explícita en la tabla", () => {
    const markup = renderToStaticMarkup(createElement(ComplaintTable, {
      quejas: [complaint],
      onSelect() {},
      selectedId: null,
    }));
    expect(markup).toContain("◌ Sin analizar");
  });

  it("explica el reintento en el detalle sin llamarlo neutral", () => {
    const markup = renderToStaticMarkup(createElement(ComplaintDetail, {
      queja: complaint,
      onClose() {},
      onAction() {},
      onOpenOther() {},
    }));
    expect(markup).toContain("Sin analizar");
    expect(markup).toContain("No se pudo analizar el texto; se reintentará al abrir la queja");
    expect(markup).not.toContain("Neutral");
  });
});