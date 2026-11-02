import { describe, expect, it } from "vitest";
import { login } from "../src/features/auth/authService.local.js";
import { usuarios } from "../src/features/auth/data/usuarios.json";
import { createCachedLoader } from "../src/data/repositories/repositoryUtils.js";
import { listClientes, getCliente, getMiCliente } from "../src/data/repositories/clientesRepository.js";
import { listPedidos, getPedido, countPedidosByEstado } from "../src/data/repositories/pedidosRepository.js";
import { listExistencias, getExistencia } from "../src/data/repositories/existenciasRepository.js";
import { listQuejas, getQueja } from "../src/data/repositories/quejasRepository.js";
import { listProductos, getProducto, getAliasIndex } from "../src/data/repositories/catalogoRepository.js";
import { listSucursales, getSucursal } from "../src/data/repositories/sucursalesRepository.js";
import { listDirectorio } from "../src/data/repositories/directorioRepository.js";

function createMemoryStore() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function sessionFor(username) {
  const store = createMemoryStore();
  const user = usuarios.find((candidate) => candidate.usuario === username);
  const result = login(username, user.password, {
    get: (key, fallback) => {
      const value = store.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    },
    set: (key, value) => store.setItem(key, JSON.stringify(value)),
    remove: (key) => store.removeItem(key),
  });
  expect(result.ok).toBe(true);
  return result.session;
}

const errorDePermiso = (promise, mensaje) =>
  expect(promise).rejects.toThrowError(mensaje);

describe("repositorios de datos con alcance y permisos", () => {
  it("dirección ve los totales y el conteo completo de pedidos", async () => {
    const session = sessionFor("ernesto");
    expect(await listClientes(session)).toHaveLength(2000);
    expect(await listPedidos(session)).toHaveLength(3000);
    expect(await listExistencias(session)).toHaveLength(320);
    expect(await listQuejas(session)).toHaveLength(221);
    expect(await countPedidosByEstado(session)).toMatchObject({
      entregado: 2593,
      cancelado: 221,
      devuelto: 89,
      enCurso: 97,
    });
  }, 15_000);

  it("el cliente solo consulta los pedidos enumerados en su ficha", async () => {
    const session = sessionFor("cliente1");
    const source = await import("@data/source/clientes.json");
    const cliente = source.default.clientes.find((item) => item.idCliente === session.idCliente);
    const pedidos = await listPedidos(session);
    expect(pedidos.map((pedido) => pedido.idPedido).sort()).toEqual([...cliente.pedidos].sort());
    const otroPedido = (await listPedidos(sessionFor("ernesto")))
      .find((pedido) => pedido.idCliente !== session.idCliente);
    expect(await getPedido(session, otroPedido.idPedido)).toBeNull();
    expect(await getMiCliente(session)).toMatchObject({ idCliente: session.idCliente });
    await errorDePermiso(listClientes(session), "No tienes permiso para ver clientes");
    await errorDePermiso(listExistencias(session), "No tienes permiso para ver existencias");
    await errorDePermiso(listQuejas(session), "No tienes permiso para ver quejas");
    await errorDePermiso(listDirectorio(session), "No tienes permiso para ver el directorio");
  });

  it("la gerente de León solo ve sus clientes, pedidos, existencias y quejas", async () => {
    const session = sessionFor("mariana");
    const clientes = await listClientes(session);
    const pedidos = await listPedidos(session);
    const existencias = await listExistencias(session);
    const quejas = await listQuejas(session);
    const source = await import("@data/source/clientes.json");
    const sourceQuejas = await import("@data/source/quejas.json");
    const clienteDeQueretaro = source.default.clientes.find((cliente) => cliente.idSucursal === "qro");
    const quejaDeOtraSucursal = sourceQuejas.default.quejas.find((queja) =>
      queja.idSucursal !== "leo" && queja.idSucursalSurtido !== "leo",
    );

    expect(clientes.every((cliente) => cliente.idSucursal === "leo")).toBe(true);
    expect(pedidos.every((pedido) =>
      pedido.idSucursal === "leo" || pedido.idSucursalSurtido === "leo",
    )).toBe(true);
    expect(existencias).toHaveLength(64);
    expect(existencias.every((existencia) => existencia.idSucursal === "leo")).toBe(true);
    expect(quejas.every((queja) =>
      queja.idSucursal === "leo" || queja.idSucursalSurtido === "leo",
    )).toBe(true);
    expect(await getCliente(session, clienteDeQueretaro.idCliente)).toBeNull();
    expect(await getQueja(session, quejaDeOtraSucursal.idQueja)).toBeNull();
    expect(await listClientes(session, { idSucursal: "qro" })).toEqual([]);
    await errorDePermiso(listDirectorio(session), "No tienes permiso para ver el directorio");
  });

  it("bodega de Guadalajara ve su inventario y los filtros no cambian de sucursal", async () => {
    const session = sessionFor("tono");
    const existencias = await listExistencias(session);
    expect(existencias).toHaveLength(64);
    expect(existencias.every((existencia) => existencia.idSucursal === "gdl")).toBe(true);
    expect(await getExistencia(session, "CLO-1L", "gdl")).toMatchObject({ disponible: 203 });
    expect(await getExistencia(session, "CLO-1L", "leo")).toBeNull();
    await errorDePermiso(listClientes(session), "No tienes permiso para ver clientes");
  });

  it("un vendedor de León solo ve registros de su sucursal", async () => {
    const vendedor = usuarios.find((user) => user.rol === "ventas" && user.idSucursal === "leo");
    expect(vendedor).toBeTruthy();
    const session = sessionFor(vendedor.usuario);
    const [clientes, pedidos, quejas, existencias] = await Promise.all([
      listClientes(session),
      listPedidos(session),
      listQuejas(session),
      listExistencias(session),
    ]);

    expect(clientes.length).toBeGreaterThan(0);
    expect(clientes.every((cliente) => cliente.idSucursal === "leo")).toBe(true);
    expect(pedidos.length).toBeGreaterThan(0);
    expect(pedidos.every((pedido) =>
      pedido.idSucursal === "leo" || pedido.idSucursalSurtido === "leo",
    )).toBe(true);
    expect(quejas.every((queja) =>
      queja.idSucursal === "leo" || queja.idSucursalSurtido === "leo",
    )).toBe(true);
    expect(quejas.length).toBeGreaterThan(0);
    expect(existencias.length).toBeGreaterThan(0);
    expect(existencias.every((existencia) => existencia.idSucursal === "leo")).toBe(true);
  });

  it("compras puede ver todas las existencias, pero no los pedidos", async () => {
    const session = sessionFor("yesenia.flores");
    expect(await listExistencias(session)).toHaveLength(320);
    await errorDePermiso(listPedidos(session), "No tienes permiso para ver pedidos");
  });

  it("TI ve el directorio sin claves sensibles, pero no los pedidos", async () => {
    const session = sessionFor("carlos");
    const directorio = await listDirectorio(session);
    const camposSensibles = [
      "salarioMensualMXN",
      "rfc",
      "fechaNacimiento",
      "password",
      "telefonoMovil",
      "correoInstitucional",
    ];
    expect(directorio).toHaveLength(140);
    expect(directorio.every((empleado) =>
      camposSensibles.every((campo) => !(campo in empleado)),
    )).toBe(true);
    await errorDePermiso(listPedidos(session), "No tienes permiso para ver pedidos");
  });

  it("filtra texto ignorando acentos y nunca amplía el alcance", async () => {
    const direccion = sessionFor("ernesto");
    const clientes = await listClientes(direccion, { texto: "tendajon dona lupe" });
    expect(clientes.some((cliente) => cliente.nombreComercial === "Tendajón Doña Lupe")).toBe(true);
    expect(await listPedidos(sessionFor("mariana"), { idCliente: "CLI-0416" })).toEqual([]);
    expect(await listExistencias(sessionFor("mariana"), { idSucursal: "qro" })).toEqual([]);
  });

  it("devuelve copias independientes y resuelve las búsquedas de catálogo", async () => {
    const session = sessionFor("ernesto");
    const [first, product] = await Promise.all([
      listClientes(session),
      getProducto("CLO-1L"),
    ]);
    first[0].direccion.calle = "Modificada";
    first[0].pedidos.push("PED-INVALIDO");
    product.nombre = "Modificado";
    expect((await getCliente(session, first[0].idCliente)).direccion.calle).not.toBe("Modificada");
    expect((await getCliente(session, first[0].idCliente)).pedidos).not.toContain("PED-INVALIDO");
    expect((await getProducto("CLO-1L")).nombre).toBe("Cloro 1 litro");

    const aliasIndex = await getAliasIndex();
    expect(aliasIndex.get("cloro 1l")).toBe("CLO-1L");
    expect(aliasIndex.get("cloro 1 litro")).toBe("CLO-1L");
    aliasIndex.set("cloro 1l", "ALTERADO");
    expect((await getAliasIndex()).get("cloro 1l")).toBe("CLO-1L");
    expect(await listProductos()).toHaveLength(64);
  });

  it("expone sucursales como copias síncronas", () => {
    const sucursales = listSucursales();
    expect(sucursales).toHaveLength(5);
    sucursales[0].nombre = "Modificada";
    expect(getSucursal("gdl").nombre).toBe("Río Claro Guadalajara");
    expect(getSucursal("desconocida")).toBeNull();
  });

  it("comparte una sola promesa para cargar e indexar el JSON", async () => {
    let imports = 0;
    let indexaciones = 0;
    const loader = createCachedLoader(
      () => {
        imports += 1;
        return Promise.resolve({ default: { filas: [1, 2, 3] } });
      },
      (data) => {
        indexaciones += 1;
        return data.filas;
      },
    );
    const first = loader();
    const second = loader();
    expect(second).toBe(first);
    await expect(first).resolves.toEqual([1, 2, 3]);
    expect(imports).toBe(1);
    expect(indexaciones).toBe(1);
  });

  it("busca pedidos por folio y quejas por identificador con copias", async () => {
    const session = sessionFor("ernesto");
    const pedido = (await listPedidos(session))[0];
    expect(await getPedido(session, pedido.folio)).toEqual(pedido);
    const queja = (await listQuejas(session))[0];
    const result = await getQueja(session, queja.idQueja);
    expect(result.idQueja).toBe(queja.idQueja);
    result.descripcion = "Modificada";
    expect((await getQueja(session, queja.idQueja)).descripcion).not.toBe("Modificada");
  });
});
