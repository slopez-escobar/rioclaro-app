import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { DATA_DIR, ROOT } from "./helpers/paths.js";
import { usuarios } from "../src/features/auth/data/usuarios.json";
import { roles } from "../src/features/auth/data/roles.json";
import { SYSTEM_PROMPT } from "../src/features/chat/domain/guidelines.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

describe("datos generados para la API", () => {
  it("sincroniza usuarios, roles y prompt con sus fuentes", () => {
    const apiUsers = JSON.parse(fs.readFileSync(
      path.join(ROOT, "api", "data", "usuarios.json"),
      "utf8",
    )).usuarios;
    const apiRoles = JSON.parse(fs.readFileSync(
      path.join(ROOT, "api", "data", "roles.json"),
      "utf8",
    )).roles;
    const apiBranches = JSON.parse(fs.readFileSync(
      path.join(ROOT, "api", "data", "sucursales.json"),
      "utf8",
    )).sucursales;
    const appBranches = JSON.parse(fs.readFileSync(
      path.join(ROOT, "src", "config", "sucursales.json"),
      "utf8",
    )).sucursales;
    const prompt = JSON.parse(fs.readFileSync(
      path.join(ROOT, "api", "src", "prompts", "system.json"),
      "utf8",
    ));

    expect(apiUsers).toEqual(usuarios);
    expect(apiRoles).toEqual(roles);
    expect(apiBranches).toEqual(appBranches.map(({ id, nombre }) => ({ id, nombre })));
    expect(prompt).toEqual({ version: "1", systemPrompt: SYSTEM_PROMPT });
  });

  it("datos:check valida todos los artefactos generados", () => {
    execFileSync(
      process.execPath,
      [path.join(ROOT, "scripts", "preparar-datos.mjs"), "--check"],
      { cwd: currentDirectory, stdio: "pipe" },
    );
  }, 15_000);

  it("datos:check detecta un artefacto alterado en una copia temporal", () => {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rioclaro-api-check-"));
    const copiedProject = path.join(temporaryRoot, "app");
    const copyFile = (relativePath) => {
      const destination = path.join(copiedProject, relativePath);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(path.join(ROOT, relativePath), destination);
    };

    try {
      for (const file of [
        "scripts/preparar-datos.mjs",
        "scripts/datos.config.mjs",
        "src/features/policies/domain/parseVersionComparison.js",
        "src/features/chat/domain/guidelines.js",
      ]) {
        copyFile(file);
      }

      const scriptPath = path.join(copiedProject, "scripts", "preparar-datos.mjs");
      const env = { ...process.env, RC_DATA_DIR: DATA_DIR };
      execFileSync(process.execPath, [scriptPath], {
        cwd: copiedProject,
        env,
        stdio: "pipe",
      });

      const promptPath = path.join(copiedProject, "api", "src", "prompts", "system.json");
      fs.appendFileSync(promptPath, " ");
      expect(() => execFileSync(process.execPath, [scriptPath, "--check"], {
        cwd: copiedProject,
        env,
        stdio: "pipe",
      })).toThrow();
    } finally {
      fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
  }, 30_000);
});
