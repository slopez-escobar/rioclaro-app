import { app } from "@azure/functions";
import { loadConfig } from "../lib/config.js";
import { createRateLimiter } from "../lib/rateLimit.js";
import { createSpeechTokenHandler } from "../handlers/speechToken.js";

const config = loadConfig();
const handler = createSpeechTokenHandler({ config, rateLimiter: createRateLimiter() });

app.http("speechToken", {
  route: "speechToken",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: (request, context) => handler(request, context),
});
