import { classifyOrder, inPeriod, saleAmounts, toCents } from "./salesRules.js";

const HYPOTHESIS_LABELS = {
  incluye_cancelados: "Incluye pedidos cancelados",
  por_fecha_de_entrega: "Cuenta por fecha de entrega, no por fecha de pedido",
  por_sucursal_que_surte: "Cuenta lo que surte la sucursal, no lo que vende",
  con_iva: "Reporta cifras con IVA incluido",
  incluye_devueltos: "No resta las devoluciones",
};

function productCents(pedido) {
  return toCents(saleAmounts(pedido).productos);
}

function addGroup(target, key, value) {
  target[key] = (target[key] || 0) + value;
}

function totalsFor(pedidos, predicate) {
  return pedidos.reduce(
    (total, pedido) => total + (predicate(pedido) ? productCents(pedido) : 0),
    0,
  );
}

/**
 * Calcula el total de productos por sucursal bajo la definición correcta y cinco variantes.
 */
export function hypothesisTotals(pedidos, idSucursal, periodo) {
  const branchOrders = pedidos.filter((pedido) => pedido.idSucursal === idSucursal);
  const periodOrders = branchOrders.filter((pedido) => inPeriod(pedido.fechaPedido, periodo));
  const correctOrders = periodOrders.filter((pedido) => classifyOrder(pedido) === "neta");
  const correct = correctOrders.reduce((sum, pedido) => sum + productCents(pedido), 0);

  const canceledIncluded = totalsFor(
    periodOrders,
    (pedido) => pedido.estado === "cancelado",
  );
  const deliveredOrders = branchOrders.filter((pedido) =>
    pedido.estado === "entregado" && inPeriod(pedido.fechaEntrega, periodo),
  );
  const deliveredFromOtherMonth = deliveredOrders
    .filter((pedido) => !inPeriod(pedido.fechaPedido, periodo))
    .reduce((sum, pedido) => sum + productCents(pedido), 0);
  const periodOrdersNotDeliveredInPeriod = correctOrders
    .filter((pedido) => !deliveredOrders.includes(pedido))
    .reduce((sum, pedido) => sum + productCents(pedido), 0);

  const salesSuppliedHere = pedidos.filter((pedido) =>
    pedido.idSucursalSurtido === idSucursal
    && pedido.idSucursal !== idSucursal
    && inPeriod(pedido.fechaPedido, periodo)
    && classifyOrder(pedido) === "neta",
  );
  const branchSalesSuppliedElsewhere = correctOrders.filter(
    (pedido) => pedido.idSucursalSurtido !== idSucursal,
  );
  const suppliedProducts = salesSuppliedHere.reduce(
    (sum, pedido) => sum + productCents(pedido),
    0,
  );
  const suppliedElsewhereProducts = branchSalesSuppliedElsewhere.reduce(
    (sum, pedido) => sum + productCents(pedido),
    0,
  );
  const ivaProducts = correctOrders.reduce(
    (sum, pedido) => sum + (pedido.articulos || []).reduce(
      (lineSum, articulo) => lineSum + toCents(articulo.iva?.importe),
      0,
    ),
    0,
  );
  const returnedProducts = totalsFor(
    periodOrders,
    (pedido) => pedido.estado === "devuelto",
  );
  const deliveredTotal = deliveredOrders.reduce(
    (sum, pedido) => sum + productCents(pedido),
    0,
  );

  return {
    correcta: { total: correct / 100, desglose: {} },
    incluye_cancelados: {
      total: (correct + canceledIncluded) / 100,
      desglose: { canceladosIncluidos: canceledIncluded / 100 },
    },
    por_fecha_de_entrega: {
      total: deliveredTotal / 100,
      desglose: {
        entregadosEnElPeriodoDePedidosDeOtroMes: deliveredFromOtherMonth / 100,
        pedidosDelPeriodoNoEntregadosEnElPeriodo: periodOrdersNotDeliveredInPeriod / 100,
      },
    },
    por_sucursal_que_surte: {
      total: (correct + suppliedProducts - suppliedElsewhereProducts) / 100,
      desglose: {
        ventasDeOtrasSucursalesSurtidasPorEstaSucursal: suppliedProducts / 100,
        ventasDeEstaSucursalSurtidasPorOtras: suppliedElsewhereProducts / 100,
      },
    },
    con_iva: {
      total: (correct + ivaProducts) / 100,
      desglose: { ivaDeProductos: ivaProducts / 100 },
    },
    incluye_devueltos: {
      total: (correct + returnedProducts) / 100,
      desglose: { devolucionesIncluidas: returnedProducts / 100 },
    },
  };
}

/** Identifica qué hipótesis reproduce el total reportado, con tolerancia de un centavo. */
export function explainDifference(reportado, hipotesisTotales) {
  const reportadoCents = toCents(reportado);
  const coincidencias = Object.entries(hipotesisTotales)
    .filter(([name, value]) =>
      name !== "correcta" && Math.abs(toCents(value.total) - reportadoCents) <= 1,
    )
    .map(([name]) => name);
  const hipotesis = coincidencias[0] || null;
  return {
    hipotesis,
    ambiguas: coincidencias,
    descripcion: hipotesis ? HYPOTHESIS_LABELS[hipotesis] : "Sin explicar",
    desglose: hipotesis ? hipotesisTotales[hipotesis].desglose : {},
  };
}
