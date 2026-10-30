import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getUnificacion, searchUnificacionProducts } from "../src/data/repositories/unificacionRepository.js";
import { DATA_DIR, FUENTES, ROOT } from "./helpers/paths.js";

const resultPath = path.join(ROOT, "src", "data", "source", "unificacion.json");
const result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
const answerKeyPath = path.join(DATA_DIR, FUENTES.equivalenciasInventario);
const hasAnswerKey = fs.existsSync(answerKeyPath);
const direccionSession = { rol: "direccion", alcance: "todas", idSucursal: "gdl" };
if (!hasAnswerKey) {
  console.info("Se omite la evaluación porque no está disponible la clave de equivalencias.");
}

describe("informe unificado de sucursales", () => {
  it("incluye cinco sucursales con 64 filas leídas cada una", () => {
    expect(Object.keys(result.sucursales)).toEqual(["gdl", "zap", "leo", "qro", "ags"]);
    for (const branch of Object.values(result.sucursales)) {
      expect(branch.filasLeidas).toBe(64);
    }
  });

  it("conserva los cinco nombres del cloro y las convenciones esperadas", () => {
    const cloro = result.productos.find((product) => product.claveProducto === "CLO-1L");
    expect(cloro.contradicciones.nombresDistintos).toBe(5);
    expect(result.sucursales.zap.convenciones).toMatchObject({
      precioIncluyeIVA: true,
      existenciaSignifica: "disponible",
    });
    for (const branch of ["gdl", "leo", "qro", "ags"]) {
      expect(result.sucursales[branch].convenciones).toMatchObject({
        factorPrecio: 1,
        precioIncluyeIVA: false,
        existenciaSignifica: "fisica",
      });
    }
  });

  it("normaliza precios sin diferencias y conserva el contraste publicado de Zapopan", () => {
    expect(result.productos.every(
      (product) => !product.contradicciones.preciosNormalizadosDistintos,
    )).toBe(true);
    expect(result.productos.every(
      (product) => product.contradicciones.preciosPublicadosDistintos,
    )).toBe(true);
  });

  it("la búsqueda encuentra productos por nombres publicados", async () => {
    const products = await searchUnificacionProducts("Blanqueador 1000ml", direccionSession);
    expect(products.map((product) => product.claveProducto)).toContain("CLO-1L");
    const report = await getUnificacion(direccionSession);
    report.productos[0].nombreCatalogo = "Alterado";
    expect((await getUnificacion(direccionSession)).productos[0].nombreCatalogo).not.toBe("Alterado");
  });

  it("rechaza la lectura del informe sin permiso para ver existencias", async () => {
    await expect(getUnificacion({
      rol: "cliente",
      alcance: "propio",
      idCliente: "CLI-0001",
    })).rejects.toThrowError("No tienes permiso para ver existencias");
  });

  it("limita los detalles visibles y las revisiones según el alcance", async () => {
    const report = await getUnificacion({
      rol: "ventas",
      alcance: "sucursal",
      idSucursal: "leo",
    });
    expect(Object.keys(report.sucursales)).toEqual(["leo"]);
    expect(report.productos.every(
      (product) => Object.keys(product.porSucursal).every((branch) => branch === "leo"),
    )).toBe(true);
    expect(report.resumen).toMatchObject({
      filasTotales: 64,
      resueltas: 64,
      enRevision: 0,
      productosConAlMenos2Nombres: 0,
      productosConPreciosPublicadosDistintos: 0,
    });
    expect(report.productos.every(
      (product) => product.contradicciones.nombresDistintos <= 1,
    )).toBe(true);
    expect(report.revision).toEqual([]);
    const bodegaReport = await getUnificacion({
      rol: "bodega",
      alcance: "sucursal",
      idSucursal: "ags",
    });
    expect(bodegaReport.revision.every((row) => row.sucursal === "ags")).toBe(true);
  });

  it.skipIf(!hasAnswerKey)(
    "evalúa la clave de equivalencias sin permitir asignaciones incorrectas",
    () => {
      const key = JSON.parse(fs.readFileSync(answerKeyPath, "utf8"));
      let totalResueltas = 0;
      const errores = [];
      const expectedBranches = ["gdl", "zap", "leo", "qro", "ags"];
      for (const branchId of expectedBranches) {
        const expectedByKey = new Map(
          key.equivalencias.map((item) => [item.claveProducto, item.porSucursal[branchId]]),
        );
        for (const product of result.productos) {
          const actual = product.porSucursal[branchId];
          if (!actual) continue;
          totalResueltas += 1;
          const expected = expectedByKey.get(product.claveProducto);
          if (!expected
            || actual.codigo !== expected.codigo
            || actual.nombrePublicado !== expected.nombre) {
            errores.push({
              sucursal: branchId,
              claveProducto: product.claveProducto,
              actual,
              esperado: expected,
            });
          }
        }
      }
      const minRows = Math.ceil(320 * 0.9);
      console.info(
        `Evaluación del catálogo: ${totalResueltas} resueltas; ${result.resumen.enRevision} en Revisar; nombres: ${result.revision.map((row) => `${row.sucursal}/${row.nombrePublicado}`).join(", ") || "ninguno"}.`,
      );
      expect(totalResueltas).toBeGreaterThanOrEqual(minRows);
      expect(errores).toEqual([]);
    },
  );
});
