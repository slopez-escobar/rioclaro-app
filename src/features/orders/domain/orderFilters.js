function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX")
    .trim();
}

/**
 * Filtra solo la lista que el repositorio ya limitó por permisos y alcance.
 */
export function filterOrders(orders, filters = {}) {
  const query = normalize(filters.texto);
  return orders.filter((order) => {
    const date = String(order.fechaPedido || "").slice(0, 10);
    const matchesText = !query || normalize([
      order.folio,
      order.idPedido,
      order.idCliente,
      order.clienteNombre,
      order.idSucursal,
      order.sucursalNombre,
      order.estadoLabel,
      order.canal,
      order.tipoEntregaLabel,
      ...(order.articulos || []).map((item) => item.descripcion),
    ].join(" ")).includes(query);
    return (!filters.estado || order.estado === filters.estado)
      && (!filters.desde || date >= filters.desde)
      && (!filters.hasta || date <= filters.hasta)
      && (!filters.tipoEntrega || order.tipoEntrega === filters.tipoEntrega)
      && (!filters.idSucursal || order.idSucursal === filters.idSucursal)
      && matchesText;
  });
}
