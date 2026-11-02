import { describe, expect, it } from "vitest";
import { AZURE_SERVICES, PILOT_BUDGET } from "../src/config/pilotCost.js";
import { buildBudgetStatus } from "../src/features/dashboard/domain/pilotConfig.js";
import { createDashboardService, dashboardService } from "../src/features/dashboard/dashboardService.js";
import { login } from "../src/features/auth/authService.local.js";
import { createLocalStore } from "../src/shared/storage/localStore.js";

function memoryStore() {
  return createLocalStore({
    values: new Map(),
    getItem(key) { return this.values.get(key) ?? null; },
    setItem(key, value) { this.values.set(key, value); },
    removeItem(key) { this.values.delete(key); },
  });
}

function sessionFor(user) {
  const result = login(user, "demo123", memoryStore());
  if (!result.ok) throw new Error(`No se pudo iniciar sesión de prueba: ${user}`);
  return result.session;
}

describe("panel de dirección", () => {
  it("resume las cifras iniciales de Dirección y conserva la conciliación", async () => {
    const panel = await dashboardService.getPanel(sessionFor("ernesto"));

    expect(panel.ventas).toMatchObject({
      estado: "ok",
      datos: {
        ventasNetas: 21550713.64,
        totalConIva: 25155254.3,
        devoluciones: 768392.07,
        cancelados: 1717143.97,
        sumaSucursalesIgualTotal: true,
      },
    });
    expect(panel.facturas).toMatchObject({
      estado: "ok",
      datos: {
        total: 9,
        porEstado: { Aprobada: 4, OK: 2, Revisar: 1, Duplicada: 1, Rechazada: 1 },
        duplicadasBloqueadas: 1,
      },
    });
    expect(panel.quejas).toMatchObject({
      estado: "ok",
      datos: { total: 221, primeraRespuesta: { porcentaje: 23, cumplen15: 48, conRespuesta: 210 } },
    });
    expect(panel.existencias).toMatchObject({
      estado: "ok",
      datos: { agotados: 21, bajos: 41, pedidosEnCurso: 97 },
    });
    expect(panel.costo).toMatchObject({
      estado: "ok",
      datos: { estadoPresupuesto: { estado: "sin_datos", gastado: null } },
    });
  });

  it("respeta permisos de Finanzas y el alcance de la sucursal de Mariana", async () => {
    const finance = await dashboardService.getPanel(sessionFor("laura"));
    expect(finance.ventas.estado).toBe("ok");
    expect(finance.facturas.estado).toBe("ok");
    expect(finance.quejas).toMatchObject({
      estado: "sin_acceso",
      mensaje: "Tu rol no tiene acceso a esta información.",
    });
    expect(finance.existencias.estado).toBe("sin_acceso");

    const branch = await dashboardService.getPanel(sessionFor("mariana"));
    expect(branch.ventas).toMatchObject({
      estado: "ok",
      datos: {
        ventasNetas: 3339117.82,
        esUnaSucursal: true,
        porSucursal: [{ id: "leo", pedidos: 450, ventasNetas: 3339117.82 }],
      },
    });
    expect(branch.facturas.estado).toBe("sin_acceso");
    expect(branch.quejas.estado).toBe("ok");
    expect(branch.existencias.estado).toBe("ok");
  });

  it.each(["tono", "yesenia.flores", "carlos", "cliente1"])(
    "rechaza el panel para %s",
    async (user) => {
      await expect(dashboardService.getPanel(sessionFor(user)))
        .rejects.toThrow("No tienes permiso para ver el panel");
    },
  );

  it("mantiene los demás bloques cuando falla un servicio", async () => {
    const service = createDashboardService({
      sales: { getReport: async () => { throw new Error("Error interno"); } },
      invoices: {
        summary: () => ({
          porEstado: { Aprobada: 0, OK: 0, Revisar: 0, Duplicada: 0, Rechazada: 0 },
          pendientesDeDireccion: 0,
          horasHumanasEstimadas: 0,
          horasLineaBase: 12,
          porcentajeReduccion: 100,
        }),
      },
      complaints: { kpis: async () => ({}) },
      inventory: { summary: async () => ({ agotados: 0, bajos: 0, fechaCorte: "2026-10-01" }) },
      orders: { summary: async () => ({ enCurso: 0, surtidosDesdeOtraSucursal: 0 }) },
    });
    const panel = await service.getPanel(sessionFor("ernesto"));
    expect(panel.ventas).toMatchObject({
      estado: "error",
      mensaje: "No se pudo cargar este bloque.",
    });
    expect(panel.facturas.estado).toBe("ok");
    expect(panel.quejas.estado).toBe("ok");
    expect(panel.existencias.estado).toBe("ok");
    expect(panel.costo.estado).toBe("ok");
  });
});

describe("presupuesto del piloto", () => {
  it("clasifica gasto sin datos, dentro del límite, en alerta y excedido", () => {
    expect(buildBudgetStatus(PILOT_BUDGET)).toEqual({
      gastado: null,
      porcentajeDelCredito: null,
      porcentajeDeLaAlerta: null,
      estado: "sin_datos",
    });
    expect(buildBudgetStatus({ creditoUSD: 99, alertaUSD: 20, gastoRealUSD: 19 }).estado)
      .toBe("dentro");
    expect(buildBudgetStatus({ creditoUSD: 99, alertaUSD: 20, gastoRealUSD: 20 }))
      .toMatchObject({ porcentajeDelCredito: 20.2, porcentajeDeLaAlerta: 100, estado: "alerta" });
    expect(buildBudgetStatus({ creditoUSD: 99, alertaUSD: 20, gastoRealUSD: 99 }))
      .toMatchObject({ porcentajeDelCredito: 100, porcentajeDeLaAlerta: 495, estado: "excedido" });
    expect(AZURE_SERVICES).toHaveLength(6);
    expect(AZURE_SERVICES.every((service) => service.estimadoUSD === null)).toBe(true);
  });
});
