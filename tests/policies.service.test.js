import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createVersionesLoader } from "../src/data/repositories/devolucionesVersionesRepository.js";
import { policyService } from "../src/features/policies/policyService.js";
import { parsePolicy } from "../src/features/chat/knowledge/parsePolicy.js";
import { sessionFor } from "./chatTestUtils.js";

describe("servicio de políticas", () => {
  it("limita clientes a las nueve políticas públicas y oculta las internas", async () => {
    const customer = sessionFor("cliente1");
    const policies = await policyService.listPolicies(customer);
    expect(policies).toHaveLength(9);
    expect(policies.every((policy) => policy.audiencia === "publica")).toBe(true);
    expect(await policyService.getPolicy(customer, "POL-10")).toBeNull();
    await expect(policyService.getComparison(customer)).rejects.toThrow(
      "Esta información es solo para empleados",
    );
  });

  it("muestra las 13 políticas a empleados y el comparador de nueve temas", async () => {
    const employee = sessionFor("yesenia.flores");
    const policies = await policyService.listPolicies(employee);
    expect(policies).toHaveLength(13);
    expect(policies.filter((policy) => policy.audiencia === "interna")).toHaveLength(4);
    expect(policies.find((policy) => policy.id === "POL-01").version).toBe("3.0");
    const comparison = await policyService.getComparison(employee);
    expect(comparison.contradicciones).toHaveLength(9);
    const policy = await policyService.getPolicy(employee, "POL-01");
    const currentPeriod = comparison.contradicciones.find((item) => item.tema === "Plazo").v3;
    expect(policy.version).toBe("3.0");
    expect(policy.reglas.find((rule) => rule.tema === "Plazo").texto).toContain(currentPeriod);
  });

  it("filtra las políticas internas solo cuando un empleado lo solicita", async () => {
    const employee = sessionFor("yesenia.flores");
    const internal = await policyService.listPolicies(employee, { audiencia: "interna" });
    expect(internal.map((policy) => policy.id)).toEqual([
      "POL-10",
      "POL-11",
      "POL-12",
      "POL-13",
    ]);
  });

  it("busca sin distinguir acentos y prioriza coincidencias en el título", async () => {
    const employee = sessionFor("yesenia.flores");
    const matches = await policyService.listPolicies(employee, { texto: "devolución" });
    expect(matches[0].id).toBe("POL-01");
  });

  it("devuelve el contenido autorizado tal como aparece en el Markdown", async () => {
    const customer = sessionFor("cliente1");
    const markdown = readFileSync(
      new URL("../src/data/conocimiento/POL-03_Entregas_y_envios.md", import.meta.url),
      "utf8",
    );
    const expected = parsePolicy(markdown);
    const actual = await policyService.getPolicy(customer, "POL-03");
    expect(actual).toMatchObject({
      id: expected.id,
      titulo: expected.titulo,
      version: expected.version,
      vigenteDesde: expected.vigenteDesde,
      proposito: expected.proposito,
      alcance: expected.alcance,
      reglas: expected.reglas,
      procedimiento: expected.procedimiento,
    });
    expect(actual.reglas).toHaveLength(8);
    expect(actual.procedimiento).toHaveLength(5);
  });

  it("no guarda una carga fallida del comparador en caché", async () => {
    let attempts = 0;
    const load = createVersionesLoader(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("sin conexión");
      return { default: { vigente: "v3" } };
    });

    await expect(load()).rejects.toThrow("No se pudo cargar el comparador");
    await expect(load()).resolves.toEqual({ vigente: "v3" });
    await expect(load()).resolves.toEqual({ vigente: "v3" });
    expect(attempts).toBe(2);
  });
});
