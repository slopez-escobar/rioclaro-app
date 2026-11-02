import { app } from "@azure/functions";
import { loadConfig } from "../lib/config.js";
import { createHealthHandler } from "../handlers/health.js";

const handler = createHealthHandler({ config: loadConfig() });

app.http("health", {
  route: "health",
  methods: ["GET"],
  authLevel: "anonymous",
  handler,
});
