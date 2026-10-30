import { describe, it, expect } from "vitest";
import { createLocalStore } from "../src/shared/storage/localStore.js";
import { login, getSession, logout, CUENTAS_DEMO } from "../src/features/auth/authService.js";
import { can, landingPath, alcanceDe } from "../src/features/auth/permissions.js";
import { usuarios } from "../src/features/auth/data/usuarios.json";
import { roles } from "../src/features/auth/data/roles.json";

const memoria = () => createLocalStore({ _m: new Map(), getItem(k) { return this._m.has(k) ? this._m.get(k) : null; }, setItem(k, v) { this._m.set(k, v); }, removeItem(k) { this._m.delete(k); } });

describe("datos de acceso", () => {
  it("hay 140 empleados y 10 clientes demo", () => {
    expect(usuarios.filter((u) => u.idEmpleado)).toHaveLength(140);
    expect(usuarios.filter((u) => u.idCliente)).toHaveLength(10);
  });
  it("los usuarios son únicos y su rol existe", () => {
    expect(new Set(usuarios.map((u) => u.usuario)).size).toBe(usuarios.length);
    const cods = new Set(roles.map((r) => r.codigo));
    expect(usuarios.every((u) => cods.has(u.rol))).toBe(true);
  });
  it("no incluye salarios, RFC ni fechas de nacimiento", () => {
    const texto = JSON.stringify(usuarios).toLowerCase();
    for (const prohibido of ["salario", "rfc", "fechanacimiento", "telefono", "correo"]) expect(texto.includes(prohibido)).toBe(false);
  });
  it("incluye a los personajes del caso con su puesto y sucursal", () => {
    const p = (n) => usuarios.find((u) => u.usuario === n);
    expect(p("ernesto")).toMatchObject({ puesto: "Director general", idSucursal: "gdl", rol: "direccion" });
    expect(p("laura")).toMatchObject({ puesto: "Analista de cuentas por pagar", idSucursal: "gdl", rol: "finanzas" });
    expect(p("mariana")).toMatchObject({ puesto: "Gerente de sucursal", idSucursal: "leo", rol: "gerente_sucursal" });
    expect(p("tono")).toMatchObject({ puesto: "Jefe de bodega", idSucursal: "gdl", rol: "bodega" });
    expect(p("carlos")).toMatchObject({ puesto: "Soporte y sistemas", idSucursal: "gdl", rol: "administrador_ti" });
  });
  it("las cuentas demo existen", () => expect(CUENTAS_DEMO.map((c) => c.usuario)).toEqual(["ernesto", "laura", "mariana", "tono", "carlos", "cliente1"]));
});

describe("inicio de sesión", () => {
  it("entra con credenciales correctas y guarda la sesión sin contraseña", () => {
    const s = memoria(); const r = login("laura", "demo123", s);
    expect(r.ok).toBe(true);
    expect(getSession(s)).toMatchObject({ usuario: "laura", rol: "finanzas", esEmpleado: true, alcance: "todas" });
    expect(JSON.stringify(getSession(s))).not.toMatch(/demo123|password/);
  });
  it("no distingue mayúsculas en el usuario", () => expect(login(" LAURA ", "demo123", memoria()).ok).toBe(true));
  it("rechaza contraseña incorrecta", () => expect(login("laura", "mal", memoria())).toMatchObject({ ok: false }));
  it("rechaza usuario inexistente y campos vacíos", () => {
    expect(login("nadie", "demo123", memoria()).ok).toBe(false);
    expect(login("", "", memoria()).ok).toBe(false);
  });
  it("cierra la sesión", () => { const s = memoria(); login("laura", "demo123", s); logout(s); expect(getSession(s)).toBeNull(); });
  it("descarta una sesión vencida", () => {
    const s = memoria(); login("laura", "demo123", s);
    const v = s.get("session"); v.expiraEn = Date.now() - 1; s.set("session", v);
    expect(getSession(s)).toBeNull();
  });
  it("un cliente entra con alcance propio y su idCliente", () => {
    const s = memoria(); login("cliente1", "demo123", s);
    expect(getSession(s)).toMatchObject({ esEmpleado: false, alcance: "propio" });
    expect(getSession(s).idCliente).toMatch(/^CLI-/);
  });
});

describe("permisos por rol", () => {
  it("finanzas aprueba facturas; compras no", () => {
    expect(can("finanzas", "facturas_proveedores", "aprobar")).toBe(true);
    expect(can("compras", "facturas_proveedores", "aprobar")).toBe(false);
  });
  it("las nóminas solo las ven dirección y recursos humanos", () => {
    const quienes = roles.filter((r) => can(r.codigo, "nominas", "ver")).map((r) => r.codigo).sort();
    expect(quienes).toEqual(["direccion", "rh"]);
  });
  it("un cliente no ve facturas ni quejas ajenas, pero usa el asistente", () => {
    expect(can("cliente", "facturas_proveedores", "ver")).toBe(false);
    expect(can("cliente", "quejas", "ver")).toBe(false);
    expect(can("cliente", "asistente_ia", "usar")).toBe(true);
  });
  it("soporte puede apagar el asistente pero no ve nóminas", () => {
    expect(can("administrador_ti", "usuarios_y_accesos", "apagar_asistente")).toBe(true);
    expect(can("administrador_ti", "nominas", "ver")).toBe(false);
  });
  it("rol desconocido no puede nada", () => expect(can("inventado", "pedidos", "ver")).toBe(false));
  it("la pantalla inicial depende del permiso", () => {
    expect(landingPath("direccion")).toBe("/panel");
    expect(landingPath("finanzas")).toBe("/facturas");
    expect(landingPath("compras")).toBe("/facturas");
    expect(landingPath("ventas")).toBe("/asistente");
    expect(landingPath("cliente")).toBe("/asistente");
  });
  it("todos los roles pueden usar el asistente (evita bucles de redirección)", () => {
    expect(roles.every((r) => can(r.codigo, "asistente_ia", "usar"))).toBe(true);
  });
  it("el alcance de bodega es la sucursal", () => expect(alcanceDe("bodega")).toBe("sucursal"));
});
