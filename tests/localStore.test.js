import { describe, it, expect } from "vitest";
import { createLocalStore } from "../src/shared/storage/localStore.js";

const fake = (opciones = {}) => {
  const m = new Map();
  return {
    get length() { return m.size; },
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    key: (index) => [...m.keys()][index] ?? null,
    setItem: (k, v) => { if (opciones.cuota) { const e = new Error("lleno"); e.name = "QuotaExceededError"; throw e; } m.set(k, v); },
    removeItem: (k) => m.delete(k),
    _m: m,
  };
};

describe("localStore", () => {
  it("guarda y lee valores con prefijo", () => {
    const b = fake(); const s = createLocalStore(b);
    expect(s.set("x", { a: 1 })).toEqual({ ok: true });
    expect(s.get("x")).toEqual({ a: 1 });
    expect([...b._m.keys()]).toEqual(["rc:v1:x"]);
  });
  it("devuelve el valor por defecto si no existe", () => {
    expect(createLocalStore(fake()).get("nada", "ninguno")).toBe("ninguno");
  });
  it("devuelve el valor por defecto si el JSON está dañado", () => {
    const b = fake(); b.setItem("rc:v1:malo", "{no es json");
    expect(createLocalStore(b).get("malo", [])).toEqual([]);
  });
  it("no lanza si se llena la cuota y avisa", () => {
    expect(createLocalStore(fake({ cuota: true })).set("x", 1)).toEqual({ ok: false, error: "cuota" });
  });
  it("elimina valores", () => {
    const s = createLocalStore(fake()); s.set("x", 1); s.remove("x");
    expect(s.get("x")).toBeNull();
  });
  it("borra solo las claves que tienen el prefijo del almacén", () => {
    const b = fake();
    b.setItem("rc:v1:facturas", "[]");
    b.setItem("rc:v1:sesion", "{}");
    b.setItem("preferencias", "oscuro");
    expect(createLocalStore(b).clearAll()).toBe(2);
    expect([...b._m.entries()]).toEqual([["preferencias", "oscuro"]]);
  });
  it("borra solo el prefijo configurado", () => {
    const b = fake();
    b.setItem("demo:uno", "1");
    b.setItem("rc:v1:dos", "2");
    expect(createLocalStore(b, "demo:").clearAll()).toBe(1);
    expect([...b._m.keys()]).toEqual(["rc:v1:dos"]);
  });
  it("sin localStorage usa memoria y funciona", () => {
    const s = createLocalStore(); s.set("k", 5);
    expect(s.get("k")).toBe(5);
  });
});
