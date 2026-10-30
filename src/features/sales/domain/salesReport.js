import { classifyOrder, inPeriod, saleAmounts, toCents } from "./salesRules.js";

function createTotals() {
  return { pedidos: 0, productos: 0, envio: 0, iva: 0, total: 0 };
}

function addAmounts(target, amounts) {
  target.pedidos += 1;
  target.productos += toCents(amounts.productos);
  target.envio += toCents(amounts.envio);
  target.iva += toCents(amounts.iva);
  target.total += toCents(amounts.total);
}

function asTotals(value) {
  return {
    pedidos: value.pedidos,
    productos: value.productos / 100,
    envio: value.envio / 100,
    iva: value.iva / 100,
    total: value.total / 100,
  };
}

function asTotal(value) {
  return { pedidos: value.pedidos, total: value.total / 100 };
}

function asProductTotals(value) {
  return { pedidos: value.pedidos, productos: value.productos / 100 };
}

function asMonthTotals(value) {
  return {
    pedidos: value.pedidos,
    productos: value.productos / 100,
    total: value.total / 100,
  };
}

function getGroup(groups, key) {
  if (!Object.hasOwn(groups, key)) groups[key] = createTotals();
  return groups[key];
}

function productAggregate(groups, key) {
  if (!Object.hasOwn(groups, key)) {
    groups[key] = { unidades: 0, importe: 0, iva: 0, total: 0 };
  }
  return groups[key];
}

function addProductLines(groups, pedido) {
  for (const articulo of pedido.articulos || []) {
    const key = String(articulo.claveProducto || "sin_clave");
    const value = productAggregate(groups, key);
    const importe = toCents(articulo.importe);
    const iva = toCents(articulo.iva?.importe);
    value.unidades += Number(articulo.cantidad) || 0;
    value.importe += importe;
    value.iva += iva;
    value.total += articulo.total == null ? importe + iva : toCents(articulo.total);
  }
}

function asProductGroups(groups) {
  return Object.fromEntries(Object.entries(groups).map(([key, value]) => [
    key,
    {
      unidades: value.unidades,
      importe: value.importe / 100,
      iva: value.iva / 100,
      total: value.total / 100,
    },
  ]));
}

/**
 * Construye un reporte usando la sucursal de venta y solo pedidos netos en sus desgloses.
 */
export function buildSalesReport(pedidos, {
  periodo,
  idSucursal,
  clientesIndex,
} = {}) {
  const netas = createTotals();
  const confirmadas = { pedidos: 0, total: 0 };
  const devueltas = { pedidos: 0, total: 0 };
  const canceladas = { pedidos: 0, total: 0 };
  const porSucursal = {};
  const porSucursalQueSurte = {};
  const matriz = {};
  const fueraDeSucursal = { pedidos: 0, productos: 0 };
  const porProducto = {};
  const porMes = {};
  const porTipoCliente = clientesIndex ? {} : null;
  const porTamano = clientesIndex ? {} : null;

  for (const pedido of pedidos) {
    if (periodo && !inPeriod(pedido.fechaPedido, periodo)) continue;
    if (idSucursal && pedido.idSucursal !== idSucursal) continue;

    const amounts = saleAmounts(pedido);
    const amountTotal = toCents(amounts.total);
    const classification = classifyOrder(pedido);
    if (classification !== "cancelado") {
      confirmadas.pedidos += 1;
      confirmadas.total += amountTotal;
    }
    if (classification === "cancelado") {
      canceladas.pedidos += 1;
      canceladas.total += amountTotal;
      continue;
    }
    if (classification === "devuelto") {
      devueltas.pedidos += 1;
      devueltas.total += amountTotal;
      continue;
    }

    addAmounts(netas, amounts);
    const saleBranch = String(pedido.idSucursal || "sin_asignar");
    const supplyingBranch = String(pedido.idSucursalSurtido || "sin_asignar");
    addAmounts(getGroup(porSucursal, saleBranch), amounts);
    addAmounts(getGroup(porSucursalQueSurte, supplyingBranch), amounts);

    if (!Object.hasOwn(matriz, saleBranch)) matriz[saleBranch] = {};
    addAmounts(getGroup(matriz[saleBranch], supplyingBranch), amounts);

    if (pedido.idSucursal !== pedido.idSucursalSurtido) {
      fueraDeSucursal.pedidos += 1;
      fueraDeSucursal.productos += toCents(amounts.productos);
    }

    const month = String(pedido.fechaPedido || "").slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(month)) {
      const monthTotals = getGroup(porMes, month);
      addAmounts(monthTotals, amounts);
    }

    addProductLines(porProducto, pedido);

    if (clientesIndex) {
      const customer = clientesIndex.get(pedido.idCliente);
      const type = String(customer?.tipoCliente || "sin_dato");
      const size = String(customer?.tamano || "sin_dato");
      addAmounts(getGroup(porTipoCliente, type), amounts);
      addAmounts(getGroup(porTamano, size), amounts);
    }
  }

  const mapGroups = (groups, project = asTotals) => Object.fromEntries(
    Object.entries(groups).map(([key, value]) => [key, project(value)]),
  );
  const mapNestedGroups = Object.fromEntries(
    Object.entries(matriz).map(([saleBranch, groups]) => [
      saleBranch,
      mapGroups(groups, asProductTotals),
    ]),
  );
  const netTotals = asTotals(netas);

  return {
    totales: {
      netas: netTotals,
      confirmadas: asTotal(confirmadas),
      devueltas: asTotal(devueltas),
      canceladas: asTotal(canceladas),
    },
    porSucursal: mapGroups(porSucursal),
    porSucursalQueSurte: mapGroups(porSucursalQueSurte, asProductTotals),
    matriz: mapNestedGroups,
    fueraDeSucursal: {
      pedidos: fueraDeSucursal.pedidos,
      productos: fueraDeSucursal.productos / 100,
    },
    porProducto: asProductGroups(porProducto),
    porMes: mapGroups(porMes, asMonthTotals),
    porTipoCliente: porTipoCliente ? mapGroups(porTipoCliente) : null,
    porTamano: porTamano ? mapGroups(porTamano) : null,
  };
}
