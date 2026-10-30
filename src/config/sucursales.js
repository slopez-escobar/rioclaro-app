import { empresa, sucursales } from "./sucursales.json";

export { empresa, sucursales };

export const SUCURSALES_POR_ID = Object.fromEntries(
  sucursales.map((sucursal) => [sucursal.id, sucursal]),
);
