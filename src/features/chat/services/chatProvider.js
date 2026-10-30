import { USE_AZURE } from "../../../config/env.js";
import { azureChatProvider } from "./chatProvider.azure.js";
import { mockChatProvider } from "./chatProvider.mock.js";

export const chatProvider = USE_AZURE ? azureChatProvider : mockChatProvider;
