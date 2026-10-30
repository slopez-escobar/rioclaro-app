import { describe, expect, it, vi } from "vitest";
import { createChatRepository } from "../src/features/chat/chatRepository.js";
import { createChatService } from "../src/features/chat/chatService.js";
import { memoryStore, sessionFor } from "./chatTestUtils.js";

function makeChat({
  provider = { sendMessage: vi.fn(async () => ({ texto: "Respuesta", fuentes: [], acciones: [], estado: "respondido" })) },
  store = memoryStore(),
  switchRepo = { isEnabled: () => true, setEnabled: vi.fn((value) => value) },
} = {}) {
  const chatRepository = createChatRepository({ store });
  const chatService = createChatService({
    provider,
    chatRepository,
    switchRepo,
    sucursales: [{ id: "gdl", nombre: "Río Claro Guadalajara", ciudad: "Guadalajara", telefono: "+52 33 3615 0100" }],
    now: () => new Date("2026-10-26T10:00:00-06:00"),
    pedidos: { listPedidos: async () => [] },
    clientes: { getMiCliente: async (session) => ({ idCliente: session.idCliente }) },
    complaints: async () => ({ ok: true, folio: "QJ-2026-0222", prioridad: "alta" }),
  });
  return { chatService, chatRepository, provider, switchRepo };
}

describe("servicio de chat", () => {
  it("guarda los dos mensajes, entrega historial reciente y devuelve contacto de sucursal", async () => {
    const { chatService, chatRepository, provider } = makeChat();
    const session = sessionFor("cliente1");
    const result = await chatService.send("Hola", session);
    expect(result).toMatchObject({ role: "assistant", texto: "Respuesta" });
    expect(chatRepository.list(session.usuario)).toHaveLength(2);
    expect(provider.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      texto: "Hola",
      session,
      historial: expect.arrayContaining([expect.objectContaining({ role: "user", texto: "Hola" })]),
    }));
    expect(await chatService.getContact(session)).toEqual({
      nombre: "Río Claro Guadalajara",
      ciudad: "Guadalajara",
      telefono: "+52 33 3615 0100",
    });
  });

  it("valida mensaje vacío y longitud máxima", async () => {
    const { chatService } = makeChat();
    const session = sessionFor("cliente1");
    await expect(chatService.send(" ", session)).rejects.toThrow("Escribe un mensaje antes de enviarlo.");
    await expect(chatService.send("x".repeat(501), session)).rejects.toThrow("El mensaje no puede superar los 500 caracteres.");
  });

  it("guarda un mensaje de error cuando el proveedor falla", async () => {
    const { chatService, chatRepository } = makeChat({
      provider: { sendMessage: async () => { throw new Error("Fallo remoto"); } },
    });
    const session = sessionFor("cliente1");
    const result = await chatService.send("¿Cómo va mi pedido?", session);
    expect(result).toMatchObject({
      role: "assistant",
      estado: "error",
      texto: "No pude responder en este momento. Intenta de nuevo o habla con una persona.",
    });
    expect(chatRepository.list(session.usuario)).toHaveLength(2);
  });

  it("aísla historial por usuario y permite borrarlo", async () => {
    const { chatService } = makeChat();
    const client = sessionFor("cliente1");
    const tono = sessionFor("tono");
    await chatService.send("Hola", client);
    expect(chatService.getHistory(client)).toHaveLength(2);
    expect(chatService.getHistory(tono)).toEqual([]);
    chatService.clear(client);
    expect(chatService.getHistory(client)).toEqual([]);
  });

  it("respeta el interruptor y adjunta la queja registrada al historial", async () => {
    let enabled = false;
    const setEnabled = vi.fn((value) => { enabled = value; return enabled; });
    const { chatService, provider, chatRepository, switchRepo } = makeChat({
      switchRepo: {
        isEnabled: () => enabled,
        setEnabled,
      },
    });
    const session = sessionFor("cliente1");
    expect(chatService.isEnabled()).toBe(false);
    expect(chatRepository.list(session.usuario)).toEqual([]);
    enabled = true;
    await chatService.send("Hola", session);
    expect(provider.sendMessage).toHaveBeenCalledTimes(1);
    expect(chatService.setEnabled(false, session)).toBe(false);
    const complaint = await chatService.registerComplaint({
      descripcion: "El pedido llegó con un producto equivocado",
      idPedido: null,
      idCliente: session.idCliente,
    }, session);
    expect(complaint.folio).toBe("QJ-2026-0222");
    expect(chatRepository.list(session.usuario).at(-1)).toMatchObject({
      role: "assistant",
      texto: expect.stringContaining("prioridad alta"),
      fuentes: [expect.objectContaining({ id: "POL-07" })],
    });
    expect(switchRepo.setEnabled).toHaveBeenCalledWith(false, session);
  });
});
