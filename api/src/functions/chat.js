import { app } from "@azure/functions";
import { loadConfig } from "../lib/config.js";
import { createRateLimiter } from "../lib/rateLimit.js";
import { createChatHandler } from "../handlers/chat.js";

const config = loadConfig();
const handler = createChatHandler({ config, rateLimiter: createRateLimiter() });

app.http("chat", {
  route: "chat",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: (request, context) => handler(request, context),
});
