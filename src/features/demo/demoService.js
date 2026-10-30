import { localStore } from "../../shared/storage/localStore.js";

export const DEMO_RESET_EVENT = "rc:demo-reset";

export const demoService = {
  resetAll(store = localStore) {
    const claves = store.clearAll();
    if (typeof globalThis.dispatchEvent === "function" && typeof globalThis.CustomEvent === "function") {
      globalThis.dispatchEvent(new CustomEvent(DEMO_RESET_EVENT, { detail: { claves } }));
    }
    return { claves };
  },
};
