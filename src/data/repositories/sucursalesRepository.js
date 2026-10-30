import { sucursales } from "../../config/sucursales.json";
import { copy } from "./repositoryUtils.js";

/**
 * Lista copias de las sucursales configuradas.
 */
export function listSucursales() {
  return copy(sucursales);
}

/**
 * Busca una copia de sucursal por identificador o devuelve null.
 */
export function getSucursal(id) {
  const sucursal = sucursales.find((item) => item.id === id);
  return sucursal ? copy(sucursal) : null;
}
