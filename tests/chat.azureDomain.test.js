import { describe, expect, it } from "vitest";
import { REFUSAL_SENSITIVE } from "../src/features/chat/domain/guidelines.js";
import {
  classifyState,
  collectSources,
  compactToolResult,
  inferActions,
  toolCallToApp,
} from "../src/features/chat/domain/azureChat.js";
import { createTools } from "../src/features/chat/tools/chatTools.js";
import { listPedidos } from "../src/data/repositories/pedidosRepository.js";
import { sessionFor } from "./chatTestUtils.js";

const tools = createTools();
const privateTerms = /direccion|tel[eé]fono|rfc|password|contraseñ/i;

describe("dominio del chat Azure", () => {
  it("compacta existencias respetando el alcance cualitativo de clientes", async () => {
    const employee = await tools.consultarExistencias(
      { producto: "cloro de litro" },
      sessionFor("tono"),
    );
    const employeeJson = compactToolResult("consultar_existencias", employee);
    expect(JSON.parse(employeeJson)).toMatchObject({
      ok: true,
      tipo: "existencias",
      producto: { clave: "CLO-1L", nombre: "Cloro 1 litro" },
      sucursales: [expect.objectContaining({ sucursal: "Guadalajara", disponible: 203 })],
    });
    expect(employeeJson).not.toMatch(privateTerms);

    const customer = await tools.consultarExistencias(
      { producto: "cloro de litro" },
      sessionFor("cliente1"),
    );
    const customerJson = compactToolResult("consultar_existencias", customer);
    expect(JSON.parse(customerJson).sucursales[0]).toMatchObject({
      sucursal: "Guadalajara",
      disponibilidad: "Disponible",
    });
    expect(customerJson).not.toMatch(/"(disponible|existencia|comprometido)"\s*:\s*\d+/i);
    const defensiveCustomerJson = compactToolResult("consultar_existencias", {
      ok: true,
      tipo: "existencias",
      resultados: [{ sucursal: "Guadalajara", disponible: 203, existencia: 240 }],
    }, sessionFor("cliente1"));
    expect(defensiveCustomerJson).not.toMatch(/"(disponible|existencia|comprometido)"\s*:\s*\d+/i);
  });

  it("reduce precios, pedidos, políticas y quejas a sus campos permitidos", async () => {
    const customer = sessionFor("cliente1");
    const price = await tools.consultarPrecio({ producto: "cloro de litro" }, customer);
    const priceJson = compactToolResult("consultar_precio", price);
    expect(JSON.parse(priceJson)).toMatchObject({
      precioLista: 18.5,
      iva: 2.96,
      precioConIVA: 21.46,
      precioConDescuento: 17.02,
      totalConDescuento: 19.74,
      nota: expect.stringContaining("iguales"),
    });
    expect(priceJson).not.toMatch(privateTerms);

    const order = await tools.estadoPedido(
      { referencia: (await listPedidos(customer))[0].folio },
      customer,
    );
    const orderJson = compactToolResult("estado_pedido", order);
    expect(JSON.parse(orderJson).pedidos[0]).toHaveProperty("folio");
    expect(orderJson).not.toMatch(privateTerms);

    const policy = await tools.buscarPolitica(
      { consulta: "¿cuántos días tengo para devolver?" },
      customer,
    );
    const policyJson = compactToolResult("buscar_politica", policy);
    expect(JSON.parse(policyJson).fragmentos[0]).toMatchObject({
      id: expect.any(String),
      titulo: expect.any(String),
      version: "3.0",
      tema: expect.any(String),
    });
    expect(JSON.parse(policyJson).fragmentos[0].texto.length).toBeLessThanOrEqual(600);

    const complaintTools = createTools({
      complaints: {
        registerComplaint: async () => ({ folio: "QJ-2026-0999", prioridad: "media" }),
        repository: {},
        deps: {},
      },
    });
    const complaint = await complaintTools.registrarQueja(
      { descripcion: "El pedido llegó incompleto y necesito apoyo" },
      customer,
    );
    expect(JSON.parse(compactToolResult("registrar_queja", complaint))).toEqual({
      ok: true,
      folio: "QJ-2026-0999",
      prioridad: "media",
    });
  });

  it("recorta listas antes de exceder 4000 caracteres y devuelve errores seguros", () => {
    const largeResult = {
      ok: true,
      tipo: "existencias",
      claveProducto: "CLO-1L",
      producto: "Cloro de litro",
      corte: "2026-10-23 12:00",
      resultados: Array.from({ length: 100 }, (_, index) => ({
        sucursal: `Sucursal ${index} ${"x".repeat(80)}`,
        disponible: 203,
        existencia: 240,
        comprometido: 37,
        estatusStock: "normal",
      })),
      fuentes: [{ tipo: "existencias", id: "CLO-1L" }],
    };
    const compact = compactToolResult("consultar_existencias", largeResult);
    expect(compact.length).toBeLessThanOrEqual(4000);
    expect(JSON.parse(compact).truncado).toBe(true);

    expect(JSON.parse(compactToolResult("estado_pedido", {
      ok: false,
      tipo: "no_encontrado",
      mensaje: "dato privado",
    }))).toEqual({
      ok: false,
      tipo: "no_encontrado",
      mensaje: "No se encontró información dentro de tu alcance.",
    });
    expect(JSON.parse(compactToolResult("buscar_politica", {
      ok: false,
      resultados: [],
      fuentes: [],
    }))).toMatchObject({
      ok: false,
      tipo: "sin_informacion",
      mensaje: "No se encontró información disponible.",
    });
  });

  it("traduce las cinco herramientas y rechaza argumentos inválidos", () => {
    const cases = [
      ["consultar_existencias", '{"producto":"cloro","sucursal":"León"}', "consultarExistencias"],
      ["consultar_precio", '{"producto":"cloro"}', "consultarPrecio"],
      ["estado_pedido", '{"referencia":"mi_pedido"}', "estadoPedido"],
      ["buscar_politica", '{"consulta":"devoluciones"}', "buscarPolitica"],
      ["registrar_queja", '{"descripcion":"pedido incompleto"}', "registrarQueja"],
    ];
    for (const [serverName, args, expected] of cases) {
      expect(toolCallToApp(serverName, args).herramienta).toBe(expected);
    }
    expect(toolCallToApp("herramienta_desconocida", "{}")).toEqual({
      error: "Herramienta no disponible",
    });
    expect(toolCallToApp("consultar_existencias", "{")).toEqual({
      error: "Herramienta no disponible",
    });
    expect(toolCallToApp("consultar_existencias", "[]")).toEqual({
      error: "Herramienta no disponible",
    });
    expect(toolCallToApp("consultar_existencias", '{"producto":"cloro","extra":"dato"}')).toEqual({
      error: "Herramienta no disponible",
    });
  });

  it("deduplica fuentes y calcula acciones y estados", () => {
    const source = { tipo: "politica", id: "POL-01", version: "3.0" };
    expect(collectSources([
      { fuentes: [source] },
      { resultado: { fuentes: [source, { tipo: "pedido", id: "RC-2026-000001" }] } },
    ])).toEqual([source, { tipo: "pedido", id: "RC-2026-000001" }]);
    expect(inferActions({
      texto: "Quiero poner una queja",
      resultados: [],
      estado: "ok",
      session: sessionFor("cliente1"),
    })).toEqual([{ tipo: "registrar_queja" }]);
    expect(inferActions({
      texto: "No encontré esa información. " + "¿Quieres que te pase con una persona?",
      resultados: [],
      estado: "sin_informacion",
      session: sessionFor("cliente1"),
    })).toEqual([{ tipo: "hablar_con_persona" }]);
    expect(classifyState({
      texto: "¿A cuál producto te refieres?",
      resultados: [{ tipo: "ambiguo" }],
    })).toBe("ambiguo");
    expect(classifyState({ texto: REFUSAL_SENSITIVE })).toBe("rechazado");
    expect(classifyState({ texto: "", resultados: [] })).toBe("sin_informacion");
    expect(classifyState({ texto: "Hola", resultados: [] })).toBe("ok");
  });
});
