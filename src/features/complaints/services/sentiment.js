import { USE_AZURE } from "../../../config/env.js";
import { createAzureSentiment } from "./sentiment.azure.js";
import { createMockSentiment } from "./sentiment.mock.js";

export const sentiment = USE_AZURE ? createAzureSentiment() : createMockSentiment();
export const analyze = (text) => sentiment.analyze(text);
