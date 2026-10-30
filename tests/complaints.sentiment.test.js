import { describe, expect, it } from "vitest";
import { quejas } from "../src/data/source/quejas.json";
import { createAzureSentiment } from "../src/features/complaints/services/sentiment.azure.js";
import { createMockSentiment } from "../src/features/complaints/services/sentiment.mock.js";

describe("análisis de sentimiento simulado", () => {
  const analyzer = createMockSentiment();

  it("clasifica textos negativos, positivos y neutrales", async () => {
    await expect(analyzer.analyze("El pedido llegó tarde y nadie avisó."))
      .resolves.toMatchObject({ sentimiento: "negativo", origen: "simulado" });
    await expect(analyzer.analyze("Gracias, el servicio fue excelente y amable."))
      .resolves.toMatchObject({ sentimiento: "positivo", origen: "simulado" });
    await expect(analyzer.analyze("Solicito información sobre el pedido."))
      .resolves.toMatchObject({ sentimiento: "neutral", confianza: 0.6 });
  });

  it("normaliza acentos y devuelve frases clave del dominio", async () => {
    const result = await analyzer.analyze("Cancelaron mi pedido sin avisarme; hubo cobro duplicado.");
    expect(result.sentimiento).toBe("negativo");
    expect(result.frasesClave).toEqual(["cobro duplicado", "cancelaron mi pedido", "sin avisarme"]);
  });

  it("clasifica negativamente la mayoría de las descripciones históricas", async () => {
    const results = await Promise.all(quejas.map((complaint) => analyzer.analyze(complaint.descripcion)));
    const negativePercentage = Math.round(
      results.filter((result) => result.sentimiento === "negativo").length / results.length * 100,
    );
    expect(negativePercentage).toBeGreaterThan(50);
  });

  it("mantiene el contrato pendiente de Azure AI Language", async () => {
    await expect(createAzureSentiment().analyze("texto"))
      .rejects.toThrow("Análisis de Azure no implementado (paso B3)");
  });
});
