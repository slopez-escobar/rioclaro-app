import { describe, expect, it } from "vitest";
import { getExistenciasMeta } from "../src/data/repositories/existenciasRepository.js";
import { getBaseCount } from "../src/data/repositories/quejasRepository.js";
import { listPedidos } from "../src/data/repositories/pedidosRepository.js";
import { createTools } from "../src/features/chat/tools/chatTools.js";
import { sessionFor } from "./chatTestUtils.js";

const tools = createTools();

describe("herramientas del asistente", () => {
  it("consulta el cloro de litro con alias y conserva la fuente", async () => {
    const tone = sessionFor("tono");
    const queries = ["cloro de litro", "CLORO LITRO", "Blanqueador 1000ml", "Cloro (litro)"];
    const outputs = await Promise.all(queries.map((producto) =>
      tools.consultarExistencias({ producto }, tone),
    ));
    for (const result of outputs) {
      expect(result.ok).toBe(true);
      expect(result.resultados).toContainEqual(expect.objectContaining({
        sucursal: "Guadalajara",
        disponible: 203,
      }));
      expect(result.fuentes[0]).toMatchObject({ tipo: "existencias", id: "CLO-1L" });
      expect(result.corte).toContain("2026-10-23");
    }
  });

  it("filtra existencias de León y rechaza otra sucursal para Mariana", async () => {
    const mariana = sessionFor("mariana");
    const result = await tools.consultarExistencias(
      { producto: "Blanqueador de 1000ml", sucursal: "León" },
      mariana,
    );
    expect(result.resultados[0].sucursal).toBe("León");
    const denied = await tools.consultarExistencias(
      { producto: "Cloro 1 litro", sucursal: "Guadalajara" },
      mariana,
    );
    expect(denied).toMatchObject({ ok: false, tipo: "fuera_de_alcance", sucursalPropia: "León" });
  });

  it("lista cinco sucursales para Dirección y devuelve ambigüedad sin presentación", async () => {
    const ernesto = sessionFor("ernesto");
    const allBranches = await tools.consultarExistencias({ producto: "cloro de litro" }, ernesto);
    expect(allBranches.resultados).toHaveLength(5);
    const ambiguous = await tools.consultarExistencias({ producto: "cloro" }, ernesto);
    expect(ambiguous).toMatchObject({ ok: false, tipo: "ambiguo" });
    expect(ambiguous.opciones).toHaveLength(3);
  });

  it("expone al cliente solo disponibilidad cualitativa en su sucursal", async () => {
    const customer = sessionFor("cliente1");
    const stock = await tools.consultarExistencias({ producto: "cloro de litro" }, customer);
    expect(stock).toMatchObject({ ok: true, sucursal: "Guadalajara", disponibilidad: "Disponible" });
    const json = JSON.stringify(stock);
    expect(json).not.toMatch(/"(existencia|comprometido|disponible)"\s*:\s*\d+/i);
    const branch = await tools.consultarExistencias({ producto: "cloro", sucursal: "León" }, customer);
    expect(branch.tipo).toBe("fuera_de_alcance");
  });

  it("calcula precio, IVA y descuento por cliente con redondeo por unidad", async () => {
    const customer = sessionFor("cliente1");
    const price = await tools.consultarPrecio({ producto: "cloro de litro" }, customer);
    expect(price).toMatchObject({
      precioLista: 18.5,
      ivaLista: 2.96,
      precioConIVA: 21.46,
      descuentoPct: 8,
      precioConDescuento: 17.02,
      ivaConDescuento: 2.72,
      totalConDescuento: 19.74,
    });
    expect(price.fuentes).toEqual(expect.arrayContaining([
      expect.objectContaining({ tipo: "catalogo", id: "CLO-1L" }),
      expect.objectContaining({ tipo: "politica", id: "POL-04", version: "1.0" }),
    ]));
  });

  it("devuelve únicamente pedidos visibles y no revela pedidos ajenos", async () => {
    const customer = sessionFor("cliente1");
    const ownOrders = await listPedidos(customer);
    const own = await tools.estadoPedido({ referencia: ownOrders[0].folio }, customer);
    expect(own).toMatchObject({ ok: true, folio: ownOrders[0].folio });
    const otherOrder = (await listPedidos(sessionFor("ernesto"))).find((item) => item.idCliente !== customer.idCliente);
    expect(await tools.estadoPedido({ referencia: otherOrder.folio }, customer)).toMatchObject({
      ok: false,
      tipo: "no_encontrado",
    });
    expect(own.fuentes[0]).toEqual({ tipo: "pedido", id: ownOrders[0].folio });
  });

  it("busca políticas permitidas por audiencia y no expone POL-10 a clientes", async () => {
    const customer = sessionFor("cliente1");
    const employee = sessionFor("yesenia.flores");
    const restricted = await tools.buscarPolitica({ consulta: "quién aprueba pagos a proveedores" }, customer);
    expect(restricted).toMatchObject({ ok: false, fuentes: [] });
    const permitted = await tools.buscarPolitica({ consulta: "quién aprueba pagos a proveedores" }, employee);
    expect(permitted.fuentes[0]).toMatchObject({ tipo: "politica", id: "POL-10" });
  });

  it("expone solo metadatos de corte y el conteo base de quejas", async () => {
    expect(await getExistenciasMeta()).toEqual({ fechaCorte: "2026-10-23 12:00" });
    expect(await getBaseCount()).toBe(221);
  });
});
