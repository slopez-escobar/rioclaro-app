import { app } from "@azure/functions";
import { loadConfig } from "../lib/config.js";
import { createRateLimiter } from "../lib/rateLimit.js";
import { createLoginHandler } from "../handlers/login.js";

const config = loadConfig();
const rateLimiter = createRateLimiter();
const handler = createLoginHandler({ config, rateLimiter });

app.http("login", {
  route: "login",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: (request) => handler(request),
});
