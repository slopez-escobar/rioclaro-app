import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DATA_DIR } from "../scripts/datos.config.mjs";
import generatedComparison from "../src/data/source/devoluciones-versiones.json";
import { parseVersionComparison } from "../src/features/policies/domain/parseVersionComparison.js";

function findSourceFile(root, fileName) {
  const pending = [root];
  while (pending.length) {
    const directory = pending.pop();
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const currentPath = path.join(directory, entry.name);
      if (entry.isDirectory()) pending.push(currentPath);
      else if (entry.isFile() && entry.name === fileName) return currentPath;
    }
  }
  throw new Error(`No se encontró ${fileName} en ${root}.`);
}

const hasSourceData = existsSync(DATA_DIR);
const sourceMarkdown = hasSourceData
  ? readFileSync(findSourceFile(
    path.join(DATA_DIR, "Politicas"),
    "CLAVE_comparacion_politicas.md",
  ), "utf8")
  : "";
const withoutOriginalExtensions = (value) => {
  if (typeof value === "string") return value.replace(/\.(docx|xlsx)\b/gi, "");
  if (Array.isArray(value)) return value.map(withoutOriginalExtensions);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      withoutOriginalExtensions(item),
    ]));
  }
  return value;
};

describe.skipIf(!hasSourceData)("comparación de versiones de devoluciones", () => {
  it("analiza las tres versiones y las nueve contradicciones del archivo fuente", () => {
    const result = parseVersionComparison(sourceMarkdown);
    expect(result.versiones.map(({ clave }) => clave)).toEqual(["v1", "leon", "v3"]);
    expect(result.versiones).toHaveLength(3);
    expect(result.contradicciones.map(({ tema }) => tema)).toEqual([
      "Plazo",
      "Estado del producto",
      "Reporte de daños",
      "Quién autoriza",
      "Compensación",
      "Cargo por manejo",
      "Flete de recolección",
      "No retornables",
      "Sucursales",
    ]);
    expect(result.contradicciones[0]).toMatchObject({
      v1: "30 días naturales",
      leon: "8 días naturales",
      v3: "15 días naturales",
    });
    expect(JSON.stringify(result)).not.toContain("Solo para quien evalúa");
    expect(result.notaVigente).not.toContain("Solo para quien evalúa");
    expect(result.contradicciones.every((item) => !item.v3.includes("**"))).toBe(true);
  });

  it("coincide exactamente con el JSON generado", () => {
    expect(withoutOriginalExtensions(parseVersionComparison(sourceMarkdown))).toEqual(generatedComparison);
  });

  it("falla en español cuando falta una tabla o una versión", () => {
    expect(() => parseVersionComparison("# inválido")).toThrow(
      "No se encontró la tabla de versiones",
    );
    expect(() => parseVersionComparison(sourceMarkdown.replace(/\| `Politica_Devoluciones_Leon_NUEVA\.docx`.*\r?\n/, "")))
      .toThrow("exactamente 3 versiones");
    expect(() => parseVersionComparison(sourceMarkdown.replace("| Tema | v1 (2018) | León (2022) | v3 (2024) |", "| Tema | v1 | León | v3 |")))
      .toThrow("No se encontró la tabla de contradicciones");
  });
});
