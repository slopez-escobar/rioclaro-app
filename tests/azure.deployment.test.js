import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { API_BASE_URL } from "../src/config/env.js";
import { ROOT } from "./helpers/paths.js";

const API_ORIGIN = "https://rioclaro-api-sle-e4c6brcsbkdkd7h0.belgiumcentral-01.azurewebsites.net/api";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value));
}

function copyProjectFile(relativePath, projectRoot) {
  const destination = path.join(projectRoot, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(ROOT, relativePath), destination);
  return destination;
}

describe("despliegue Azure Storage + Functions", () => {
  it("usa la URL local del proxy en desarrollo y la URL de producción en el build", () => {
    const azureEnvironment = fs.readFileSync(path.join(ROOT, ".env.azure"), "utf8");
    const apiPackage = JSON.parse(fs.readFileSync(
      path.join(ROOT, "api", "package.json"),
      "utf8",
    ));
    const apiLock = JSON.parse(fs.readFileSync(
      path.join(ROOT, "api", "package-lock.json"),
      "utf8",
    ));
    const hostConfig = JSON.parse(fs.readFileSync(path.join(ROOT, "api", "host.json"), "utf8"));
    const viteConfig = fs.readFileSync(path.join(ROOT, "vite.config.js"), "utf8");
    const configSource = fs.readFileSync(
      path.join(ROOT, "api", "src", "lib", "config.js"),
      "utf8",
    );
    const funcIgnore = fs.readFileSync(path.join(ROOT, "api", ".funcignore"), "utf8");
    const localSettings = JSON.parse(fs.readFileSync(
      path.join(ROOT, "api", "local.settings.example.json"),
      "utf8",
    ));

    expect(API_BASE_URL).toBe("/api");
    expect(azureEnvironment).toContain("VITE_USE_AZURE=true");
    expect(azureEnvironment).toContain(`VITE_API_BASE_URL=${API_ORIGIN}`);
    expect(viteConfig).toContain('"/api"');
    expect(viteConfig).toContain('"http://localhost:7071"');
    expect(hostConfig.extensions.http.routePrefix).toBe("api");
    expect(apiPackage.engines.node).toBe(">=22");
    expect(apiPackage.dependencies["@azure/functions"]).toMatch(/^4\./);
    expect(apiPackage.devDependencies?.["@azure/functions"]).toBeUndefined();
    expect(apiLock.packages[""].engines.node).toBe(">=22");
    expect(apiLock.packages["node_modules/@azure/functions"].dev).toBeUndefined();
    expect(funcIgnore).not.toMatch(/^node_modules$/m);
    expect(funcIgnore).toMatch(/^local\.settings\.json$/m);
    expect(funcIgnore).toMatch(/^tests$/m);
    expect(funcIgnore).toMatch(/^README\*$/m);
    expect(funcIgnore).toMatch(/^\.funcignore$/m);
    expect(localSettings.Values.FUNCTIONS_WORKER_RUNTIME).toBe("node");
    expect(configSource).toContain("env = process.env");
    expect(hostConfig.extensions.http.routePrefix).toBe("api");
    expect(fs.existsSync(path.join(ROOT, "staticwebapp.config.json"))).toBe(false);
  });

  it("deja el preflight OPTIONS a la plataforma y usa rutas API sin acoplarse a SWA", () => {
    const functionsDirectory = path.join(ROOT, "api", "src", "functions");
    const apiSourceDirectory = path.join(ROOT, "api", "src");
    const functionFiles = fs.readdirSync(functionsDirectory)
      .filter((name) => name.endsWith(".js"));
    expect(functionFiles).toHaveLength(6);

    for (const file of functionFiles) {
      const source = fs.readFileSync(path.join(functionsDirectory, file), "utf8");
      expect(source).toMatch(/route:\s*"(?:health|login|speechToken|extractInvoice|analyzeComplaint|chat)"/);
      expect(source).toMatch(/methods:\s*\[(?:"GET"|"POST")(?:,\s*"(?:GET|POST)")*\]/);
      expect(source).not.toContain('"OPTIONS"');
      expect(source).not.toMatch(/staticwebapp|STATIC_WEB_APP/i);
    }
    for (const directory of ["handlers", "lib"]) {
      for (const file of fs.readdirSync(path.join(apiSourceDirectory, directory))) {
        if (!file.endsWith(".js")) continue;
        const source = fs.readFileSync(
          path.join(apiSourceDirectory, directory, file),
          "utf8",
        );
        expect(source).not.toMatch(/staticwebapp|STATIC_WEB_APP/i);
      }
    }
  });

  it("configura despliegues manuales y push, y excluye archivos locales del paquete API", () => {
    const workflow = fs.readFileSync(
      path.join(ROOT, ".github", "workflows", "deploy.yml"),
      "utf8",
    );
    const functionIgnore = fs.readFileSync(path.join(ROOT, "api", ".funcignore"), "utf8");

    expect(workflow).toContain("push:");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("node-version: 22");
    expect(workflow).toContain("npm ci");
    expect(workflow).toContain("npm test");
    expect(workflow).toContain("npm run build:azure");
    expect(workflow).toContain("npm run verificar:azure");
    expect(workflow).toContain("needs: pruebas");
    expect(workflow).toContain("AZURE_STORAGE_CONNECTION_STRING");
    expect(workflow).toContain("az storage blob delete-batch");
    expect(workflow).toContain("az storage blob upload-batch");
    expect(workflow).toContain("--overwrite true");
    expect(workflow).toContain("az storage blob update");
    expect(workflow).toContain("mimetypes.guess_type");
    expect(workflow).toContain("AZURE_FUNCTIONAPP_PUBLISH_PROFILE");
    expect(workflow).toContain("Azure/functions-action@v1");
    expect(workflow).toContain("app-name: rioclaro-api-sle");
    expect(workflow).toContain("package: api");
    expect(workflow).toContain("npm ci --omit=dev");
    expect(functionIgnore).toContain("local.settings.json");
    expect(functionIgnore).toContain("tests");
    expect(functionIgnore).toContain("README*");
    expect(functionIgnore).toContain(".funcignore");
    expect(fs.existsSync(path.join(ROOT, "staticwebapp.config.json"))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, ".github", "workflows", "azure-static-web-apps.yml"))).toBe(false);
  });

  it("omite solo las comprobaciones dependientes de data/ cuando no está disponible", () => {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rioclaro-azure-check-"));
    const appRoot = path.join(temporaryRoot, "app");
    const missingData = path.join(temporaryRoot, "data");
    try {
      const verifierPath = copyProjectFile(
        "scripts/verificar-paquete-azure.mjs",
        appRoot,
      );
      copyProjectFile("scripts/datos.config.mjs", appRoot);
      writeJson(path.join(appRoot, "src", "features", "auth", "data", "usuarios.json"), {
        usuarios: [{ usuario: "prueba", password: "local-only" }],
      });
      fs.writeFileSync(
        path.join(appRoot, ".env.azure"),
        `VITE_API_BASE_URL=${API_ORIGIN}\n`,
      );
      fs.mkdirSync(path.join(appRoot, "dist-azure"), { recursive: true });
      fs.writeFileSync(
        path.join(appRoot, "dist-azure", "assets.js"),
        `fetch("${API_ORIGIN}/health");`,
      );

      const verifyResult = spawnSync(process.execPath, [verifierPath], {
        cwd: appRoot,
        env: { ...process.env, RC_DATA_DIR: missingData },
        encoding: "utf8",
      });
      expect(verifyResult.status).toBe(0);
      expect(verifyResult.stdout).toContain("omitida: data/ no disponible");
      expect(verifyResult.stdout).toContain("Incluye ruta de API");
      expect(verifyResult.stdout.match(/\bOK\b/g)).toHaveLength(7);
      expect(verifyResult.stdout).not.toContain("Sin RFC ni correos de empleados");

      const preparationPath = copyProjectFile(
        "scripts/preparar-datos.mjs",
        appRoot,
      );
      copyProjectFile("src/features/policies/domain/parseVersionComparison.js", appRoot);
      copyProjectFile("src/features/chat/domain/guidelines.js", appRoot);
      writeJson(path.join(appRoot, "src", "features", "auth", "data", "usuarios.json"), {
        usuarios: [],
      });
      for (const directory of ["src", "public", "api"]) {
        fs.mkdirSync(path.join(appRoot, directory), { recursive: true });
      }

      const checkResult = spawnSync(
        process.execPath,
        [preparationPath, "--check"],
        {
          cwd: appRoot,
          env: { ...process.env, RC_DATA_DIR: missingData },
          encoding: "utf8",
        },
      );
      expect(checkResult.status).toBe(0);
      expect(checkResult.stdout).toContain("omitida: data/ no disponible");

      fs.writeFileSync(path.join(appRoot, "api", "sensitive.js"), "salarioMensualMXN");
      const unsafeResult = spawnSync(
        process.execPath,
        [preparationPath, "--check"],
        {
          cwd: appRoot,
          env: { ...process.env, RC_DATA_DIR: missingData },
          encoding: "utf8",
        },
      );
      expect(unsafeResult.status).toBe(1);
      expect(unsafeResult.stderr).toContain("salarioMensualMXN");
    } finally {
      fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });
});
