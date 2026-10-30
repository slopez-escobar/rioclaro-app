import { describe, expect, it } from "vitest";
import { createLocalStore } from "../src/shared/storage/localStore.js";
import { createInvoiceRepository } from "../src/features/invoices/invoiceRepository.js";
import { createChatRepository } from "../src/features/chat/chatRepository.js";
import { createChatService } from "../src/features/chat/chatService.js";
import { createComplaintActionsRepository } from "../src/features/complaints/complaintActionsRepository.js";
import { createComplaintRepository } from "../src/features/complaints/complaintRepository.js";
import { createComplaintService } from "../src/features/complaints/complaintService.js";
import { createMockSentiment } from "../src/features/complaints/services/sentiment.mock.js";
import { createAccountOverridesRepository } from "../src/features/admin/accountOverridesRepository.js";
import { createAdminAuditRepository } from "../src/features/admin/adminAuditRepository.js";
import { createAssistantSwitch } from "../src/features/chat/assistantSwitchRepository.js";
import { demoService } from "../src/features/demo/demoService.js";
import { quejas } from "../src/data/source/quejas.json";
import { facturas } from "../src/data/source/seedInvoices.json";
import { sessionFor } from "./chatTestUtils.js";

describe("restablecimiento integral de la demo", () => {
  it("recupera los datos base tras usar las áreas que guardan cambios locales", async () => {
    const values = new Map();
    const store = createLocalStore({
      get length() { return values.size; },
      getItem: (key) => values.get(key) ?? null,
      key: (index) => [...values.keys()][index] ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key),
    });
    const invoices = createInvoiceRepository({ store, seed: facturas });
    const chatRepository = createChatRepository({ store });
    const chat = createChatService({
      chatRepository,
      provider: { sendMessage: async () => ({ texto: "Respuesta", fuentes: [], acciones: [] }) },
      switchRepo: { isEnabled: () => true },
    });
    const complaintActions = createComplaintActionsRepository({ store });
    const complaintRecords = createComplaintRepository({ store, baseCount: quejas.length });
    const complaints = createComplaintService({
      quejasRepo: { listQuejas: async () => quejas },
      complaintRepo: complaintRecords,
      actionsRepo: complaintActions,
      clientesRepo: { getCliente: async () => null },
      sentiment: createMockSentiment(),
    });
    const accountOverrides = createAccountOverridesRepository({ store });
    const audit = createAdminAuditRepository({ store });
    const assistant = createAssistantSwitch({ store, envEnabled: true });
    const finance = sessionFor("laura");
    const administrator = sessionFor("carlos");

    invoices.add({ id: "FAC-TEST", hash: "test", subidaEn: "2026-10-29" });
    await chat.send("Mensaje de prueba", finance);
    complaintActions.append("QJA-0001", { accion: "responder", comentario: "Cambio de prueba" });
    accountOverrides.disable("laura", {
      desde: "2026-10-29T10:00:00.000Z",
      por: administrator.usuario,
      motivo: "Cambio de prueba",
    });
    audit.append({
      fecha: "2026-10-29T10:00:00.000Z",
      usuario: administrator.usuario,
      nombre: administrator.nombre,
      accion: "prueba",
      objetivo: "demo",
      comentario: "Cambio de prueba",
    });
    assistant.setEnabled(false, administrator);

    expect(invoices.list()).toHaveLength(10);
    expect(chat.getHistory(finance)).toHaveLength(2);
    expect(await complaints.kpis(sessionFor("ernesto"))).toMatchObject({ total: 221 });
    expect(accountOverrides.isDisabled("laura")).toBe(true);
    expect(assistant.isEnabled()).toBe(false);
    expect(audit.list()).toHaveLength(1);

    expect(demoService.resetAll(store).claves).toBeGreaterThan(0);
    expect(store.clearAll()).toBe(0);
    expect(invoices.list()).toHaveLength(9);
    expect(chat.getHistory(finance)).toEqual([]);
    expect(await complaints.kpis(sessionFor("ernesto"))).toMatchObject({ total: 221 });
    expect(accountOverrides.isDisabled("laura")).toBe(false);
    expect(assistant.isEnabled()).toBe(true);
    expect(audit.list()).toEqual([]);
    expect(store.clearAll()).toBe(1);
  });
});
