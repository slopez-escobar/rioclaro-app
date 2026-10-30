import { can } from "../auth/permissions.js";
import { AZURE_SERVICES, PILOT_BUDGET } from "../../config/pilotCost.js";
import { complaintService } from "../complaints/complaintService.js";
import { invoiceService } from "../invoices/invoiceService.js";
import { inventoryService } from "../inventory/inventoryService.js";
import { orderService } from "../orders/orderService.js";
import { salesService } from "../sales/salesService.js";
import { buildBudgetStatus } from "./domain/pilotConfig.js";

const ACCESS_MESSAGE = "Tu rol no tiene acceso a esta información.";
const ERROR_MESSAGE = "No se pudo cargar este bloque.";

function getSalesData(report, session) {
  const netas = report.totales.netas;
  return {
    ventasNetas: netas.productos,
    totalConIva: netas.total,
    devoluciones: report.totales.devueltas.total,
    pedidosDevueltos: report.totales.devueltas.pedidos,
    cancelados: report.totales.canceladas.total,
    pedidosCancelados: report.totales.canceladas.pedidos,
    esUnaSucursal: session?.alcance === "sucursal",
    sumaSucursalesIgualTotal: report.reconciliacion.sumaSucursalesIgualTotal,
    porSucursal: Object.entries(report.porSucursal).map(([id, value]) => {
      const sucursal = report.sucursales.find((branch) => branch.id === id);
      return {
        id,
        nombre: sucursal?.ciudad || sucursal?.nombre || id,
        pedidos: value.pedidos,
        ventasNetas: value.productos,
        porcentaje: netas.productos
          ? Math.round((value.productos / netas.productos) * 10000) / 100
          : 0,
      };
    }).sort((left, right) => right.ventasNetas - left.ventasNetas),
  };
}

function invoiceData(summary) {
  const porEstado = summary.porEstado;
  const aprobadasUOk = porEstado.Aprobada + porEstado.OK;
  return {
    total: Object.values(porEstado).reduce((sum, count) => sum + count, 0),
    porEstado,
    leidasSinIntervencion: aprobadasUOk,
    lecturaAutomaticaLabel: "Aprobadas u OK",
    enRevision: porEstado.Revisar,
    duplicadasBloqueadas: porEstado.Duplicada,
    pendientesDeDireccion: summary.pendientesDeDireccion,
    horasHumanasEstimadas: summary.horasHumanasEstimadas,
    horasLineaBase: summary.horasLineaBase,
    porcentajeReduccion: summary.porcentajeReduccion,
    nota: "Supuesto del prototipo: 3 min por factura en revisión y 1 min por factura aprobada; no es una medición real",
    notaLectura: "El resumen disponible no distingue la intervención en el historial; se reportan los estados Aprobada u OK.",
  };
}

/**
 * Crea el servicio del panel con cada bloque aislado y dependencias sustituibles.
 */
export function createDashboardService({
  sales = salesService,
  invoices = invoiceService,
  complaints = complaintService,
  inventory = inventoryService,
  orders = orderService,
  pilot = {
    PILOT_BUDGET,
    AZURE_SERVICES,
    buildBudgetStatus,
  },
  now = () => new Date(),
} = {}) {
  void now;

  async function loadBlock(session, modulo, fuente, load) {
    if (!can(session?.rol, modulo, "ver")) {
      return { estado: "sin_acceso", fuente, mensaje: ACCESS_MESSAGE };
    }
    try {
      return { estado: "ok", fuente, datos: await load() };
    } catch {
      return { estado: "error", fuente, mensaje: ERROR_MESSAGE };
    }
  }

  async function getPanel(session) {
    if (!can(session?.rol, "reporte_ventas", "ver")) {
      throw new Error("No tienes permiso para ver el panel");
    }

    const [ventas, facturas, quejas, existencias] = await Promise.all([
      loadBlock(
        session,
        "reporte_ventas",
        "Pedidos (3,000), reporte de ventas",
        async () => getSalesData(await sales.getReport(session), session),
      ),
      loadBlock(
        session,
        "facturas_proveedores",
        "Facturas procesadas en este navegador",
        async () => invoiceData(await invoices.summary(session)),
      ),
      loadBlock(
        session,
        "quejas",
        "Quejas (221 base + nuevas), medidas en minutos corridos",
        () => complaints.kpis(session),
      ),
      can(session?.rol, "existencias", "ver") && can(session?.rol, "pedidos", "ver")
        ? loadBlock(
          session,
          "existencias",
          "Existencias y pedidos",
          async () => {
            const [stock, orderSummary] = await Promise.all([
              inventory.summary(session),
              orders.summary(session),
            ]);
            return {
              agotados: stock.agotados,
              bajos: stock.bajos,
              fechaCorte: stock.fechaCorte,
              pedidosEnCurso: orderSummary.enCurso,
              pedidosSurtidosDesdeOtraSucursal: orderSummary.surtidosDesdeOtraSucursal,
            };
          },
        )
        : Promise.resolve({
          estado: "sin_acceso",
          fuente: "Existencias y pedidos",
          mensaje: ACCESS_MESSAGE,
        }),
    ]);

    const presupuesto = pilot.PILOT_BUDGET;
    return {
      ventas,
      facturas,
      quejas,
      existencias: {
        ...existencias,
        fuente: existencias.datos?.fechaCorte
          ? `Existencias y pedidos, corte ${existencias.datos.fechaCorte}`
          : existencias.fuente,
      },
      costo: {
        estado: "ok",
        fuente: presupuesto.fuente,
        datos: {
          presupuesto,
          estadoPresupuesto: pilot.buildBudgetStatus(presupuesto),
          servicios: pilot.AZURE_SERVICES,
        },
      },
    };
  }

  return { getPanel };
}

export const dashboardService = createDashboardService();
