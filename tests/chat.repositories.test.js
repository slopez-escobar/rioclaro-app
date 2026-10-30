import { describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "../src/config/constants.js";
import { createAssistantSwitch } from "../src/features/chat/assistantSwitchRepository.js";
import { createChatRepository } from "../src/features/chat/chatRepository.js";
import { cuotaStore, memoryStore, sessionFor } from "./chatTestUtils.js";

describe("repositorios del chat", () => {
  it("aisla historiales, conserva hasta 50 mensajes y permite limpiar", () => {
    const store = memoryStore();
    const chats = createChatRepository({ store });
    chats.append("cliente1", { role: "user", texto: "primero" });
    chats.append("cliente2", { role: "user", texto: "aislado" });
    for (let index = 0; index < 55; index += 1) {
      chats.append("cliente1", { role: index % 2 ? "assistant" : "user", texto: `mensaje ${index}` });
    }
    const history = chats.list("cliente1");
    expect(history).toHaveLength(50);
    expect(history[0].texto).toBe("mensaje 5");
    expect(history.every((item) => item.id && item.role && item.fuentes && item.acciones && item.estado && item.fecha)).toBe(true);
    expect(chats.list("cliente2").map((item) => item.texto)).toEqual(["aislado"]);
    chats.clear("cliente1");
    expect(chats.list("cliente1")).toEqual([]);
    expect(chats.list("cliente2")).toHaveLength(1);
  });

  it("persiste solo campos del mensaje y no datos sensibles", () => {
    const store = memoryStore();
    const chats = createChatRepository({ store });
    chats.append("cliente1", {
      role: "user",
      texto: "Necesito ayuda con mi pedido.",
      password: "secreto",
      salarioMensualMXN: 50000,
      correoInstitucional: "persona@rioclaro.mx",
    });

    const stored = store.get(`${STORAGE_KEYS.chat}:cliente1`);
    expect(Object.keys(stored[0]).sort()).toEqual([
      "acciones",
      "estado",
      "fecha",
      "fuentes",
      "id",
      "role",
      "texto",
    ]);
    expect(JSON.stringify(stored)).not.toMatch(/password|salarioMensualMXN|correoInstitucional/i);
  });

  it("tolera JSON dañado y comunica cuota llena", () => {
    const corruptStore = memoryStore();
    const key = `${STORAGE_KEYS.chat}:cliente1`;
    corruptStore.set(key, "not json");
    expect(createChatRepository({ store: corruptStore }).list("cliente1")).toEqual([]);
    expect(() => createChatRepository({ store: cuotaStore() }).append("cliente1", {
      role: "assistant",
      texto: "respuesta",
    })).toThrow("No se pudo guardar el historial porque el almacenamiento está lleno.");
  });

  it("permite apagar a TI, rechaza otros roles y aplica el interruptor de entorno", () => {
    const store = memoryStore();
    const switchRepo = createAssistantSwitch({ store, envEnabled: true });
    expect(switchRepo.isEnabled()).toBe(true);
    expect(switchRepo.setEnabled(false, sessionFor("carlos"))).toBe(false);
    expect(switchRepo.isEnabled()).toBe(false);
    expect(() => switchRepo.setEnabled(true, sessionFor("laura")))
      .toThrow("No tienes permiso para apagar el asistente");
    expect(() => switchRepo.setEnabled(false, sessionFor("ernesto")))
      .toThrow("No tienes permiso para apagar el asistente");
    store.set("assistantEnabled", true);
    expect(createAssistantSwitch({ store, envEnabled: false }).isEnabled()).toBe(false);
  });
});
