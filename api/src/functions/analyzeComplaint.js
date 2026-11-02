import { app } from "@azure/functions";
import { loadConfig } from "../lib/config.js";
import { createRateLimiter } from "../lib/rateLimit.js";
import { createAnalyzeComplaintHandler } from "../handlers/analyzeComplaint.js";

const config = loadConfig();
const handler = createAnalyzeComplaintHandler({ config, rateLimiter: createRateLimiter() });

app.http("analyzeComplaint", {
  route: "analyzeComplaint",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: (request, context) => handler(request, context),
});
