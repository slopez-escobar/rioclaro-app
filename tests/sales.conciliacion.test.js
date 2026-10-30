import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { pedidos } from "../src/data/source/pedidos.json";
import {
  explainDifference,
  hypothesisTotals,
} from "../src/features/sales/domain/index.js";
import { DATA_DIR, ROOT } from "./helpers/paths.js";

const reportPath = path.join(ROOT, "src", "data", "source", "ventas-conciliacion.json");
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const answerKeyPath = path.join(DATA_DIR, "Pedidos", "CLAVE_ventas_discrepancias.json");
const hasAnswerKey = fs.existsSync(answerKeyPath);
const expectedBranches = {
  gdl: { reportado: 1823672.48, correcto: 1641691.28, causa: "incluye_cancelados" },
  zap: { reportado: 652214.84, correcto: 832964.70, causa: "por_fecha_de_entrega" },
  leo: { reportado: 766586.52, correcto: 653579.36, causa: "por_sucursal_que_surte" },
  qro: { reportado: 763521.46, correcto: 658208.12, causa: "con_iva" },
  ags: { reportado: 349811.56, correcto: 318236.80, causa: "incluye_devueltos" },
};
const keyHypotheses = {
  correcta: "verdad",
  incluye_cancelados: "cancelados",
  por_fecha_de_entrega: "entrega",
  por_sucursal_que_surte: "surte",
  con_iva: "iva",
  incluye_devueltos: "devueltos",
};

if (!hasAnswerKey) {
  console.info("Se omite la comparación con la clave porque no está disponible.");
}

describe("conciliación de ventas de septiembre de 2026", () => {
  it("genera cinco reportes con totales y causas esperadas", () => {
    expect(report.meta.periodo).toBe("2026-09");
    expect(report.sucursales).toHaveLength(5);
    expect(report.resumen).toEqual({
      totalCorrecto: 4104680.26,
      sumaDeLosReportes: 4355806.86,
      diferenciaGlobal: 251126.60,
      sucursalesExplicadas: 5,
    });
    for (const [id, expected] of Object.entries(expectedBranches)) {
      const branch = report.sucursales.find((item) => item.id === id);
      expect(branch).toMatchObject({
        totalReportado: expected.reportado,
        totalCorrecto: expected.correcto,
        diferencia: Number((expected.reportado - expected.correcto).toFixed(2)),
        explicacion: { hipotesis: expected.causa },
        totalDeclaradoEnElArchivo: expected.reportado,
      });
      expect(Object.keys(branch.hipotesisProbadas)).toHaveLength(5);
      const totals = hypothesisTotals(pedidos, id, "2026-09");
      expect(totals.correcta.total).toBe(expected.correcto);
      expect(explainDifference(expected.reportado, totals)).toMatchObject({
        hipotesis: expected.causa,
        ambiguas: [expected.causa],
      });
    }
  });

  it.skipIf(!hasAnswerKey)(
    "compara hipótesis, diferencias y desgloses con la clave solo desde las pruebas",
    () => {
      const key = JSON.parse(fs.readFileSync(answerKeyPath, "utf8"));
      for (const [id, expected] of Object.entries(expectedBranches)) {
        const answer = key.sucursales[id];
        const branch = report.sucursales.find((item) => item.id === id);
        const totals = hypothesisTotals(pedidos, id, "2026-09");
        const explanation = explainDifference(expected.reportado, totals);

        expect(branch.diferencia).toBe(answer.diferencia);
        expect(branch.totalCorrecto).toBe(answer.totalCorrecto);
        expect(explanation.hipotesis).toBe(expected.causa);
        expect(keyHypotheses[explanation.hipotesis]).toBe(answer.hipotesis);
        expect(branch.explicacion.desglose).toEqual(expectedKeyBreakdown(id, answer));
        for (const [hypothesis, keyName] of Object.entries(keyHypotheses)) {
          expect(totals[hypothesis].total).toBe(key.hipotesisProbadas[id][keyName]);
        }
      }
    },
  );
});

function expectedKeyBreakdown(id, answer) {
  const expected = answer.desgloseDeLaDiferencia;
  if (id === "zap") {
    return {
      entregadosEnElPeriodoDePedidosDeOtroMes: expected.entregadosEnSeptDePedidosDeOtroMes,
      pedidosDelPeriodoNoEntregadosEnElPeriodo: expected.pedidosDeSeptNoEntregadosEnSept,
    };
  }
  if (id === "leo") {
    return {
      ventasDeOtrasSucursalesSurtidasPorEstaSucursal:
        expected.ventasDeOtrasSucursalesSurtidasPorLeon,
      ventasDeEstaSucursalSurtidasPorOtras: expected.ventasDeLeonSurtidasPorOtras,
    };
  }
  return expected;
}
