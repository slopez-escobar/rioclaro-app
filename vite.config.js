import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const dataRoot = resolve(projectRoot, "src", "data");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@data": dataRoot,
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:7071",
        changeOrigin: true,
      },
    },
    fs: {
      allow: [projectRoot],
    },
  },
  build: {
    rollupOptions: {
      input: {
        app: resolve(projectRoot, "index.html"),
        dataRepositories: resolve(projectRoot, "src", "data", "repositories", "index.js"),
      },
      preserveEntrySignatures: "strict",
    },
  },
  test: { environment: "node", include: ["tests/**/*.test.js"] },
});
