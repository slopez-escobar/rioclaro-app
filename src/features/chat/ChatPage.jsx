import { useCallback, useEffect, useMemo, useState } from "react";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { can } from "../auth/permissions.js";
import AiNotice from "../../shared/ui/AiNotice.jsx";
import Button from "../../shared/ui/Button.jsx";
import Layout from "../../shared/ui/Layout.jsx";
import { chatService } from "./chatService.js";
import ActionButtons from "./components/ActionButtons.jsx";
import AssistantSwitch from "./components/AssistantSwitch.jsx";
import ComplaintDialog from "./components/ComplaintDialog.jsx";
import Composer from "./components/Composer.jsx";
import MessageList from "./components/MessageList.jsx";
import SuggestedQuestions from "./components/SuggestedQuestions.jsx";
import "./chat.css";

export default function ChatPage() {
  useDocumentTitle("Asistente");
  const { session } = useAuth();
  const [history, setHistory] = useState(() => chatService.getHistory(session));
  const [enabled, setEnabled] = useState(() => chatService.isEnabled());
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [contact, setContact] = useState(null);
  const [pageError, setPageError] = useState("");

  const welcome = useMemo(() => ({
    id: "welcome",
    role: "assistant",
    texto: `Hola ${session?.nombre || "usuario"}, soy el asistente virtual (IA) de Río Claro. Puedo ayudarte con existencias, precios, pedidos y políticas.`,
    fuentes: [],
    acciones: [],
    estado: "respondido",
    fecha: new Date().toISOString(),
  }), [session?.nombre]);
  const messages = history.length ? history : [welcome];
  const hasStockPermission = can(session?.rol, "existencias", "ver");
  const canCreateComplaint = can(session?.rol, "quejas", "crear");

  const refresh = useCallback(() => {
    setHistory(chatService.getHistory(session));
    setEnabled(chatService.isEnabled());
  }, [session]);

  useEffect(() => {
    refresh();
    const handleStorage = (event) => {
      if (!event.key || event.key === "rc:v1:assistantEnabled") setEnabled(chatService.isEnabled());
      if (!event.key || event.key.startsWith(`rc:v1:chat:${session?.usuario?.toLowerCase()}`)) {
        setHistory(chatService.getHistory(session));
      }
    };
    globalThis.addEventListener?.("storage", handleStorage);
    return () => globalThis.removeEventListener?.("storage", handleStorage);
  }, [refresh, session]);

  const submit = useCallback(async (text) => {
    setBusy(true);
    setPageError("");
    try {
      await chatService.send(text, session);
      setHistory(chatService.getHistory(session));
    } catch (error) {
      setPageError(error.message || "No se pudo enviar el mensaje.");
    } finally {
      setBusy(false);
    }
  }, [session]);

  const clearHistory = () => {
    if (!globalThis.confirm("¿Quieres borrar toda esta conversación?")) return;
    chatService.clear(session);
    setHistory([]);
    setContact(null);
  };

  const loadOrders = useCallback(async (currentSession, customerId) => {
    const loaded = await chatService.getComplaintOrders(currentSession, customerId);
    setOrders(loaded);
    return loaded;
  }, []);

  const registerComplaint = async (input) => {
    await chatService.registerComplaint(input, session);
    setHistory(chatService.getHistory(session));
    setDialogOpen(false);
  };

  const updateSwitch = (value) => {
    const nextEnabled = chatService.setEnabled(value, session);
    setEnabled(nextEnabled);
    return nextEnabled;
  };

  const openContact = async () => {
    setContact(await chatService.getContact(session));
  };

  return (
    <Layout titulo="Asistente">
      <section className="chat-page" aria-label="Asistente Río Claro">
        <div className="chat-topbar">
          <AiNotice />
          <AssistantSwitch session={session} enabled={enabled} onChange={updateSwitch} />
        </div>
        {!enabled ? <p className="chat-off-banner" role="status">El asistente está temporalmente apagado</p> : null}
        {pageError ? <p className="chat-page-error" role="alert">{pageError}</p> : null}
        {contact ? (
          <aside className="chat-contact" aria-live="polite">
            <div>
              <strong>{contact.nombre}</strong>
              <a href={`tel:${contact.telefono.replace(/[^\d+]/g, "")}`}>{contact.telefono}</a>
            </div>
            <button type="button" aria-label="Cerrar información de contacto" onClick={() => setContact(null)}>×</button>
          </aside>
        ) : null}
        <MessageList
          messages={messages}
          contact={contact}
          onAction={openContact}
          onComplaint={() => setDialogOpen(true)}
          canCreateComplaint={canCreateComplaint}
        />
        {busy ? <p className="chat-typing" role="status">El asistente está escribiendo…</p> : null}
        {!history.length ? <SuggestedQuestions session={session} onSelect={submit} /> : null}
        <Composer disabled={!enabled} busy={busy} onSend={submit} />
        <div className="chat-bottom">
          <ActionButtons contact={contact} onContact={openContact} onComplaint={() => setDialogOpen(true)} canCreateComplaint={canCreateComplaint} />
          <Button variant="ghost" className="chat-clear-button" disabled={!history.length || busy} onClick={clearHistory}>
            Borrar conversación
          </Button>
        </div>
        <ComplaintDialog
          open={dialogOpen}
          session={session}
          orders={orders}
          onLoadOrders={loadOrders}
          onClose={() => setDialogOpen(false)}
          onSubmit={registerComplaint}
        />
        {!hasStockPermission ? <span className="sr-only">Las consultas de existencias no están disponibles para este rol.</span> : null}
      </section>
    </Layout>
  );
}
