import fs from "node:fs";
import { File } from "node:buffer";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { detectSecretFindings } from "../scripts/auditar-seguridad.mjs";

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.resolve(APP_ROOT, "..", "data");
const manifest = JSON.parse(fs.readFileSync(
  new URL("../public/facturas-prueba/manifest.json", import.meta.url),
  "utf8",
));

function detectFromTemporaryFile(contents) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "rioclaro-security-audit-"));
  const filePath = path.join(directory, "fixture.txt");
  try {
    fs.writeFileSync(filePath, contents, "utf8");
    return detectSecretFindings(fs.readFileSync(filePath, "utf8"));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

async function loadSampleFile(name) {
  const filePath = path.resolve(APP_ROOT, "public", "facturas-prueba", name);
  const contents = fs.readFileSync(filePath);
  const type = name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg";
  return new File([contents], name, { type });
}

async function createPrivacyDeps() {
  const { createResponsibleAiDeps } = await import("../src/features/responsible-ai/responsibleAiDeps.js");
  return createResponsibleAiDeps({
    loadManifest: async () => manifest,
    loadSampleFile,
    now: () => new Date("2026-10-25T18:00:00.000Z"),
  });
}

describe("detector de secretos del auditor", () => {
  it("detecta claves de almacenamiento sin devolver el valor", () => {
    const findings = detectFromTemporaryFile([
      "AzureWebJobsStorage=DefaultEndpointsProtocol",
      "=",
      "https;AccountKey",
      "=",
      "abcXYZ;",
    ].join(""));

    expect(findings).toContain("DefaultEndpointsProtocol");
    expect(findings).toContain("AccountKey");
    expect(findings.join(" ")).not.toContain("abcXYZ");
  });

  it("detecta asignaciones largas y bloques de publicación", () => {
    const findings = detectFromTemporaryFile([
      ["AZURE_SECRET", "=", "0123456789abcdef", "0123456789abcdef"].join(""),
      ["<publish", "Profile><publish", "Data>"].join(""),
    ].join("\n"));

    expect(findings).toContain("asignación de clave, secreto, token o contraseña");
    expect(findings).toContain("perfil de publicación");
  });

  it("no marca texto limpio", () => {
    expect(detectFromTemporaryFile("endpoint=/api; modo=azure; estado=activo")).toEqual([]);
  });

  it("no marca sus propios casos de prueba ni el código del detector", () => {
    for (const fileUrl of [
      new URL("../scripts/auditar-seguridad.mjs", import.meta.url),
      new URL("./security.audit.test.js", import.meta.url),
    ]) {
      expect(detectSecretFindings(fs.readFileSync(fileUrl, "utf8"))).toEqual([]);
    }
  });
});

describe("verificaciones locales de privacidad PS-*", () => {
  const localPrivacyChecks = ["PS-1", "PS-2", "PS-3", "PS-4", "PS-5", "PS-7"];

  if (fs.existsSync(DATA_DIR) && process.env.RUN_SECURITY_PRIVACY_AUDIT === "1") {
    it.each(localPrivacyChecks)("aprueba %s", async (id) => {
      const { createResponsibleAiService } = await import("../src/features/responsible-ai/responsibleAiService.js");
      const service = createResponsibleAiService({ createDeps: createPrivacyDeps });
      const result = await service.runCheck(id);

      expect(result.estado, `${id}: ${result.resumen}`).toBe("pasa");
    }, 20_000);
  } else {
    it.skip("se ejecuta desde auditar:seguridad cuando data/ está disponible");
  }
});
