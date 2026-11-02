import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createLocalStore } from "../src/shared/storage/localStore.js";
import { getSession } from "../src/features/auth/authService.js";
import { login } from "../src/features/auth/authService.local.js";
import { usuarios } from "../src/features/auth/data/usuarios.json";
import {
  ASSISTANT_OFF,
  NO_INFO,
  REFUSAL_INJECTION,
  REFUSAL_SENSITIVE,
  SYSTEM_PROMPT,
  fragmentsAllowed,
  policiesAllowed,
  searchPolicies,
} from "../src/features/chat/domain/index.js";
import { createKnowledgeBase, loadKnowledgeBase, parsePolicy } from "../src/features/chat/knowledge/index.js";
import policyIndex from "../src/data/conocimiento/indice-politicas.json";

const sourcePath = fileURLToPath(new URL("../src/data/conocimiento/", import.meta.url));
const policyFiles = readdirSync(sourcePath).filter((file) => file.startsWith("POL-") && file.endsWith(".md"));
const markdowns = Object.fromEntries(
  policyFiles.map((file) => [file, readFileSync(new URL(`../src/data/conocimiento/${file}`, import.meta.url), "utf8")]),
);
const knowledge = createKnowledgeBase({ markdowns, indice: policyIndex });

function memoryStore() {
  return createLocalStore({
    _memory: new Map(),
    getItem(key) { return this._memory.has(key) ? this._memory.get(key) : null; },
    setItem(key, value) { this._memory.set(key, value); },
    removeItem(key) { this._memory.delete(key); },
  });
}

function sessionFor(username) {
  const store = memoryStore();
  const account = usuarios.find((user) => user.usuario === username);
  expect(account).toBeDefined();
  expect(login(username, account.password, store).ok).toBe(true);
  return getSession(store);
}

function firstPolicy(query, fragments = knowledge.fragmentos) {
  return searchPolicies(query, fragments)[0]?.fragmento;
}

describe("base de conocimiento de políticas", () => {
  it("carga las 13 políticas vigentes del índice y excluye otros Markdown", () => {
    expect(knowledge.politicas).toHaveLength(13);
    expect(knowledge.politicas.filter((policy) => policy.audiencia === "publica")).toHaveLength(9);
    expect(knowledge.politicas.filter((policy) => policy.audiencia === "interna")).toHaveLength(4);
    expect(knowledge.politicas.find((policy) => policy.id === "POL-01").version).toBe("3.0");
    expect(knowledge.politicas.filter((policy) => policy.id !== "POL-01").every((policy) => policy.version === "1.0")).toBe(true);
    expect(knowledge.fragmentos.every((fragment) => fragment.polId && fragment.titulo && fragment.version)).toBe(true);
    expect(knowledge.fragmentos.some((fragment) => fragment.titulo.includes("comparacion-devoluciones"))).toBe(false);
  });

  it("valida metadatos obligatorios y analiza las reglas y pasos de POL-03", () => {
    for (const frontMatter of [
      'titulo: Título\nversion: "1.0"',
      'id: POL-99\nversion: "1.0"',
      "id: POL-99\ntitulo: Título",
    ]) {
      expect(() => parsePolicy(`---\n${frontMatter}\n---\n`)).toThrow(Error);
    }
    const policy = parsePolicy(markdowns[policyFiles.find((file) => file.startsWith("POL-03_"))]);
    expect(policy.reglas).toHaveLength(8);
    expect(policy.procedimiento).toHaveLength(5);
    expect(policy.reglas.find((rule) => rule.tema === "Costo del envío")).toBeDefined();
  });

  it("mantiene la misma promesa y carga diferida de políticas", async () => {
    const first = loadKnowledgeBase();
    expect(loadKnowledgeBase()).toBe(first);
    expect((await first).politicas).toHaveLength(13);
  });
});

describe("acceso a políticas por sesión", () => {
  it("limita clientes a las nueve políticas públicas y permite todas a empleados", () => {
    const customer = sessionFor("cliente1");
    const employee = sessionFor("yesenia.flores");
    expect(policiesAllowed(customer, knowledge.politicas)).toHaveLength(9);
    expect(policiesAllowed(employee, knowledge.politicas)).toHaveLength(13);
    expect(fragmentsAllowed(customer, knowledge.fragmentos, knowledge.politicas).every((fragment) => fragment.audiencia === "publica")).toBe(true);
    expect(() => policiesAllowed(null, knowledge.politicas)).toThrow("Sesión requerida");
  });
});

describe("recuperación de fragmentos", () => {
  const employeeFragments = fragmentsAllowed(sessionFor("yesenia.flores"), knowledge.fragmentos, knowledge.politicas);
  const customerFragments = fragmentsAllowed(sessionFor("cliente1"), knowledge.fragmentos, knowledge.politicas);

  it.each([
    ["¿cuántos días tengo para devolver?", "POL-01", "Plazo"],
    ["¿cuánto cuesta el envío?", "POL-03", "Costo del envío"],
    ["¿desde cuántos pesos el envío es gratis?", "POL-03", "Costo del envío"],
    ["¿cómo cancelo un pedido?", "POL-02"],
    ["¿a cuántos días de crédito compro?", "POL-05"],
    ["¿puedo pedir factura?", "POL-06"],
    ["¿en cuánto tiempo responden una queja?", "POL-07", "Primera respuesta"],
    ["¿qué datos personales usan?", "POL-09"],
    ["¿quién aprueba pagos de más de 100 mil pesos?", "POL-10", "Aprobación"],
  ])("%s recupera %s", (query, policyId, theme) => {
    const result = firstPolicy(query, employeeFragments);
    expect(result?.polId).toBe(policyId);
    if (theme) expect(result?.tema).toBe(theme);
  });

  it("no devuelve resultados para preguntas fuera de las políticas", () => {
    expect(searchPolicies("¿cuál es la capital de Francia?", employeeFragments)).toEqual([]);
  });

  it("oculta políticas internas al cliente sin afectar consultas públicas", () => {
    expect(searchPolicies("¿quién aprueba pagos de proveedores?", customerFragments)).toEqual([]);
    expect(firstPolicy("¿cuánto cuesta el envío?", customerFragments)?.polId).toBe("POL-03");
    expect(firstPolicy("¿cuántos días tengo para devolver?", customerFragments)?.polId).toBe("POL-01");
    expect(firstPolicy("¿a cuántos días de crédito compro?", customerFragments)?.polId).toBe("POL-05");
  });
});

describe("lineamientos del asistente", () => {
  it("incluye las reglas de fuentes, transparencia, disponibilidad y privacidad", () => {
    expect(SYSTEM_PROMPT.toLocaleLowerCase("es-MX")).toContain("inteligencia artificial");
    expect(SYSTEM_PROMPT.toLocaleLowerCase("es-MX")).toContain("fuente");
    expect(SYSTEM_PROMPT).toContain("DISPONIBLE");
    expect(SYSTEM_PROMPT.toLocaleLowerCase("es-MX")).toContain("nóminas");
    expect(REFUSAL_SENSITIVE).toBe("No puedo compartir información de nóminas, datos de empleados ni datos de otros clientes.");
    expect(REFUSAL_INJECTION).toBe("No puedo ignorar mis reglas. Puedo ayudarte con existencias, precios, pedidos y políticas de Río Claro.");
    expect(NO_INFO).toBe("No encontré esa información en las políticas ni en los datos disponibles. ¿Quieres que te pase con una persona?");
    expect(ASSISTANT_OFF).toBe("El asistente está temporalmente apagado.");
  });
});
