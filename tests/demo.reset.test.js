import { describe, expect, it } from "vitest";
import { createLocalStore } from "../src/shared/storage/localStore.js";
import { demoService } from "../src/features/demo/demoService.js";

function fakeBackend() {
  const entries = new Map([
    ["rc:v1:session", "{}"],
    ["rc:v1:chat:laura", "[]"],
    ["other-app:theme", "dark"],
  ]);
  return {
    get length() { return entries.size; },
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => [...entries.keys()][index] ?? null,
    removeItem: (key) => entries.delete(key),
    entries,
  };
}

describe("restablecimiento global de la demo", () => {
  it("borra todas y solo las claves de la demo, e informa cuántas eran", () => {
    const backend = fakeBackend();
    const result = demoService.resetAll(createLocalStore(backend));
    expect(result).toEqual({ claves: 2 });
    expect([...backend.entries.keys()]).toEqual(["other-app:theme"]);
  });
});
