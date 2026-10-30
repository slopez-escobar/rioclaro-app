import { usuarios } from "../auth/data/usuarios.json";
import { roles } from "../auth/data/roles.json";
import seedInvoiceData from "../../data/source/seedInvoices.json";
import supplierData from "../../data/source/proveedores-catalogo.json";
import { login } from "../auth/authService.js";
import { loadKnowledgeBase } from "../chat/knowledge/knowledgeBase.js";
import { createTools } from "../chat/tools/chatTools.js";
import { createMockChatProvider } from "../chat/services/chatProvider.mock.js";
import { createAssistantSwitch } from "../chat/assistantSwitchRepository.js";
import { createChatRepository } from "../chat/chatRepository.js";
import { createChatService } from "../chat/chatService.js";
import { createInvoiceRepository } from "../invoices/invoiceRepository.js";
import { createInvoiceService } from "../invoices/invoiceService.js";
import { createMockExtractor } from "../invoices/services/extractor.mock.js";
import { createComplaintActionsRepository } from "../complaints/complaintActionsRepository.js";
import { createComplaintRepository } from "../complaints/complaintRepository.js";
import { createComplaintService } from "../complaints/complaintService.js";
import { createMockSentiment } from "../complaints/services/sentiment.mock.js";
import { createAdminService } from "../admin/adminService.js";
import { createAccountOverridesRepository } from "../admin/accountOverridesRepository.js";
import { createAdminAuditRepository } from "../admin/adminAuditRepository.js";
import { policyService } from "../policies/policyService.js";
import * as clientes from "../../data/repositories/clientesRepository.js";
import * as existencias from "../../data/repositories/existenciasRepository.js";
import * as pedidos from "../../data/repositories/pedidosRepository.js";
import * as catalogo from "../../data/repositories/catalogoRepository.js";
import * as sucursales from "../../data/repositories/sucursalesRepository.js";
import * as directorio from "../../data/repositories/directorioRepository.js";
import * as quejas from "../../data/repositories/quejasRepository.js";
import { getCatalogoPedidos } from "../../data/repositories/catalogoPedidosRepository.js";
import { createLocalStore } from "../../shared/storage/localStore.js";

const defaultNow = () => new Date();

function createMemoryStore() {
  const values = new Map();
  const backend = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
  return createLocalStore(backend);
}

async function loadDefaultManifest() {
  const response = await fetch(`${import.meta.env.BASE_URL}facturas-prueba/manifest.json`);
  if (!response.ok) {
    throw new Error(`No se pudo cargar el manifiesto de facturas (${response.status})`);
  }
  return response.json();
}

async function loadDefaultSampleFile(nombre) {
  const response = await fetch(
    `${import.meta.env.BASE_URL}facturas-prueba/${encodeURIComponent(nombre)}`,
  );
  if (!response.ok) {
    throw new Error(`No se pudo cargar el archivo de prueba ${nombre} (${response.status})`);
  }
  const blob = await response.blob();
  return new File([await blob.arrayBuffer()], nombre, {
    type: blob.type || (nombre.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg"),
  });
}

function toTimestamp(now) {
  const value = typeof now === "function" ? now() : now;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function findSessionUser(filter, users) {
  if (filter === "direccion") return users.find((user) => user.usuario === "ernesto");
  if (filter === "finanzas") return users.find((user) => user.usuario === "laura");
  if (filter === "gerente de León") return users.find((user) => user.usuario === "mariana");
  if (filter === "TI") return users.find((user) => user.usuario === "carlos");
  if (filter === "cliente" || filter === "cliente1") {
    return users.find((user) => user.usuario === "cliente1");
  }
  if (filter === "cliente5") {
    return users.find((user) => user.usuario === "cliente5")
      || users.filter((user) => user.rol === "cliente")[1];
  }
  if (filter === "cliente de otra sucursal") {
    const first = users.find((user) => user.usuario === "cliente1");
    return users.find((user) => user.rol === "cliente" && user.idSucursal !== first?.idSucursal);
  }
  const branch = sucursales.listSucursales().find((item) =>
    filter === `vendedor de ${item.ciudad}`
    || filter === `vendedor de ${item.id}`,
  );
  if (branch) {
    return users.find((user) => user.rol === "ventas"
      && user.puesto === "Vendedor"
      && user.idSucursal === branch.id);
  }
  return users.find((user) => user.usuario === filter);
}

/**
 * Construye herramientas de demostración con almacenamiento aislado en memoria.
 */
export async function createResponsibleAiDeps({
  users: usersInput = usuarios,
  createSession: sessionFactory,
  services: serviceOverrides = {},
  loadSampleFile = loadDefaultSampleFile,
  loadManifest = loadDefaultManifest,
  seedInvoices = seedInvoiceData.facturas,
  now = defaultNow,
} = {}) {
  const usersList = usersInput;
  const appStore = createMemoryStore();
  const overrides = createAccountOverridesRepository({ store: appStore });
  const switchRepo = createAssistantSwitch({ store: appStore, envEnabled: true });
  const knowledge = await loadKnowledgeBase();
  const complaintRepo = createComplaintRepository({
    store: appStore,
    baseCount: await quejas.getBaseCount(),
  });
  const complaintActions = createComplaintActionsRepository({ store: appStore });
  const complaintService = createComplaintService({
    quejasRepo: quejas,
    complaintRepo,
    actionsRepo: complaintActions,
    clientesRepo: clientes,
    sentiment: createMockSentiment({ delayMs: 0 }),
    now: () => toTimestamp(now),
  });
  const repositories = { clientes, existencias, pedidos, catalogo, sucursales, directorio };
  const tools = createTools({
    repos: repositories,
    knowledge,
    now,
  });
  const provider = createMockChatProvider({
    tools,
    switchRepository: switchRepo,
    branches: sucursales.listSucursales(),
  });
  const chatRepository = createChatRepository({ store: appStore });
  const chat = createChatService({
    provider,
    chatRepository,
    switchRepo,
    sucursales: sucursales.listSucursales(),
    now,
    pedidos,
    clientes,
    complaints: async () => { throw new Error("No se esperaba registrar una queja en esta prueba."); },
  });

  const invoiceRepo = createInvoiceRepository({ store: createMemoryStore(), seed: [] });
  const seedInvoiceRepo = createInvoiceRepository({
    store: createMemoryStore(),
    seed: seedInvoices,
  });
  const extractor = createMockExtractor({ loadManifest, delayMs: 0 });
  const invoiceOptions = (repository) => createInvoiceService({
    extractor,
    repository,
    proveedores: async () => supplierData.proveedores,
    now: () => toTimestamp(now),
  });
  const invoices = invoiceOptions(invoiceRepo);
  const seededInvoices = invoiceOptions(seedInvoiceRepo);
  const audit = createAdminAuditRepository({ store: appStore });
  const admin = createAdminService({
    usuarios: usersList,
    roles,
    overrides,
    audit,
    switchRepo,
    now: () => toTimestamp(now),
  });

  const services = {
    chat,
    provider,
    tools,
    invoices,
    seededInvoices,
    invoiceRepository: invoiceRepo,
    seedInvoiceRepository: seedInvoiceRepo,
    complaints: complaintService,
    admin,
    switchRepo,
    policies: policyService,
    repositories,
    audit,
    ...serviceOverrides,
  };

  function createSession(filter) {
    if (sessionFactory) return sessionFactory(filter);
    const user = findSessionUser(filter, usersList);
    if (!user) throw new Error(`No se encontró una sesión de prueba para "${filter}".`);
    const loginStore = createMemoryStore();
    const credentialKey = ["pass", "word"].join("");
    const result = login(user.usuario, user[credentialKey], loginStore);
    if (!result.ok) throw new Error(result.error);
    return result.session;
  }

  return {
    users: usersList,
    createSession,
    services,
    loadSampleFile,
    seedInvoices,
    now,
    getMemorySnapshot: () => appStore,
  };
}
