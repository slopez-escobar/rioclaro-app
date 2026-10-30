import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(SCRIPT_DIR, "..");
export const DATA_DIR = process.env.RC_DATA_DIR
  ? path.resolve(process.env.RC_DATA_DIR)
  : path.resolve(SCRIPT_DIR, "../../data");

export const FUENTES = {
  sucursales: "Sucursales/RioClaro_Sucursales.json",
  empleados: "Empleados/RioClaro_Empleados.json",
  usuarios: "Empleados/usuarios.json",
  puestosRoles: "Empleados/RioClaro_Puestos-y-roles.json",
  proveedores: "Proveedores/RioClaro_Proveedores.json",
  productos: "Productos/RioClaro_Catalogo-productos.json",
  pedidos: "Pedidos/RioClaro_Pedidos.json",
  catalogosPedidos: "Pedidos/RioClaro_Catalogos-pedidos.json",
  clientes: "Clientes/RioClaro_Clientes.json",
  existencias: "Inventario/RioClaro_InventarioProductos.json",
  equivalenciasInventario: "Inventario/Inventario_old/equivalencias-catalogo-sucursales.json",
  excelInventarioDir: "Inventario/Inventario_old",
  quejas: "Quejas/RioClaro_Quejas.json",
  seedInvoices: "Facturas/seedInvoices.json",
  facturasPruebaDir: "Facturas/facturas-prueba",
  politicasDir: "Politicas",
  indicePoliticas: "Politicas/indice-politicas.json",
  comparacionPoliticas:
    "Politicas/politicas_devoluciones_old/CLAVE_comparacion_politicas.md",
};
