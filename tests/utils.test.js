import { describe, it, expect } from "vitest";
import { hashFile } from "../src/shared/utils/hashFile.js";
import { formatMXN, formatDate } from "../src/shared/utils/format.js";

describe("hashFile", () => {
  it("calcula SHA-256 conocido", async () => {
    expect(await hashFile(new Blob(["abc"]))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it("el mismo contenido da el mismo hash y distinto contenido, otro", async () => {
    expect(await hashFile(new Blob(["x"]))).toBe(await hashFile(new Blob(["x"])));
    expect(await hashFile(new Blob(["x"]))).not.toBe(await hashFile(new Blob(["y"])));
  });
});
describe("formato", () => {
  it("formatea pesos mexicanos", () => expect(formatMXN(1234.5)).toMatch(/\$1,234\.50/));
  it("devuelve un guion si no es número", () => expect(formatMXN(undefined)).toBe("—"));
  it("formatea fechas ISO sin desfase de día", () => expect(formatDate("2026-10-23")).toMatch(/23/));
  it("devuelve un guion si la fecha no es válida", () => expect(formatDate("no")).toBe("—"));
});
