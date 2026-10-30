import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROUTE_ACCESS } from "../src/app/routeAccess.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relativePath) => JSON.parse(
  fs.readFileSync(path.join(ROOT, relativePath), "utf8"),
);
const users = readJson("src/features/auth/data/usuarios.json").usuarios;
const roles = readJson("src/features/auth/data/roles.json").roles;
const customers = readJson("src/data/source/clientes.json").clientes;
const branches = readJson("src/config/sucursales.json").sucursales;
const branchById = new Map(branches.map((branch) => [branch.id, branch.nombre]));

function permittedRoutes(role) {
  return ROUTE_ACCESS.filter((route) => {
    if (route.redirect) return false;
    if (!route.module) return true;
    return role.permisos[route.module]?.includes(route.action || "ver") || false;
  }).map((route) => route.label);
}

function deniedRoutes(role) {
  return ROUTE_ACCESS.filter((route) =>
    !route.redirect
    && route.module
    && !role.permisos[route.module]?.includes(route.action || "ver"),
  ).map((route) => route.label);
}

const sharedPasswords = [...new Set(users.map((user) => user.password))];
const output = [
  "# Cuentas de demostración",
  "",
  "Estas credenciales solo sirven para el prototipo local. No son un mecanismo de autenticación seguro.",
  "",
  `**Contraseña de demostración:** ${sharedPasswords.join(", ")}`,
  "",
  "## Personajes del caso",
  "",
  "| Usuario | Nombre | Puesto | Rol | Sucursal |",
  "|---|---|---|---|---|",
];

for (const username of ["ernesto", "laura", "mariana", "tono", "carlos"]) {
  const user = users.find((item) => item.usuario === username);
  const role = roles.find((item) => item.codigo === user.rol);
  output.push(
    `| ${user.usuario} | ${user.nombre} | ${user.puesto || "—"} | ${role.nombre} | ${branchById.get(user.idSucursal) || "Sin sucursal"} |`,
  );
}

output.push(
  "",
  "## Un ejemplo de cuenta por cada rol",
  "",
  "| Rol | Usuario de ejemplo | Alcance | Pantallas permitidas | No puede ver |",
  "|---|---|---|---|---|",
);

for (const role of roles) {
  const user = users.find((item) => item.rol === role.codigo);
  if (!user) throw new Error(`No hay una cuenta de demostración para el rol ${role.codigo}.`);
  output.push(
    `| ${role.nombre} (\`${role.codigo}\`) | ${user.usuario} | ${role.alcance} | ${permittedRoutes(role).join(", ")} | ${deniedRoutes(role).join(", ") || "Ninguna de las pantallas listadas"} |`,
  );
}

output.push(
  "",
  "## Clientes de demostración",
  "",
  "| Usuario | Cliente | Sucursal | Tamaño |",
  "|---|---|---|---|",
);

const demoClients = users
  .filter((user) => user.idCliente)
  .sort((a, b) => a.usuario.localeCompare(b.usuario, "es-MX", { numeric: true }));
if (demoClients.length !== 10) {
  throw new Error(`Se esperaban 10 cuentas cliente; se encontraron ${demoClients.length}.`);
}

for (const user of demoClients) {
  const customer = customers.find((item) => item.idCliente === user.idCliente);
  if (!customer) throw new Error(`No se encontró el cliente de la cuenta ${user.usuario}.`);
  output.push(
    `| ${user.usuario} | ${customer.nombreComercial} | ${branchById.get(customer.idSucursal) || "Sin sucursal"} | ${customer.tamano} |`,
  );
}

output.push(
  "",
  "El alcance `todas` incluye todas las sucursales; `sucursal` limita la consulta a la sucursal asignada; `propio` limita los datos de pedidos y quejas al cliente de la sesión.",
  "",
);

fs.mkdirSync(path.join(ROOT, "docs"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "docs", "CUENTAS_DEMO.md"), output.join("\n"), "utf8");
console.info("Se generó docs/CUENTAS_DEMO.md con las cuentas y permisos actuales.");
