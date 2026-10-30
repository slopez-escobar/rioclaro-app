import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble.jsx";

export default function MessageList({ messages, onAction, contact, onComplaint, canCreateComplaint }) {
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [messages.length]);
  return (
    <div className="chat-message-list" role="log" aria-live="polite" aria-label="Conversación">
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          mensaje={message}
          onAction={onAction}
          contact={contact}
          onComplaint={onComplaint}
          canCreateComplaint={canCreateComplaint}
        />
      ))}
      <div ref={endRef} />
    </div>
  );
}
