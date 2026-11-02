import { app } from "@azure/functions";
import { loadConfig } from "../lib/config.js";
import { createRateLimiter } from "../lib/rateLimit.js";
import { createExtractInvoiceHandler } from "../handlers/extractInvoice.js";

const config = loadConfig();
const handler = createExtractInvoiceHandler({ config, rateLimiter: createRateLimiter() });

app.http("extractInvoice", {
  route: "extractInvoice",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: (request, context) => handler(request, context),
});
