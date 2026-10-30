import { useState } from "react";
import Button from "../../../shared/ui/Button.jsx";

export default function Composer({ disabled = false, busy = false, onSend }) {
  const [text, setText] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    if (disabled || busy || !text.trim()) return;
    const message = text;
    setText("");
    await onSend(message);
  };
  const nearLimit = text.length >= 450;
  return (
    <form className="chat-composer" onSubmit={submit}>
      <label className="sr-only" htmlFor="chat-message">Escribe tu mensaje</label>
      <textarea
        id="chat-message"
        value={text}
        maxLength={500}
        rows={2}
        placeholder="Escribe tu pregunta…"
        disabled={disabled || busy}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
        aria-describedby="chat-character-count"
      />
      <div className="chat-composer-bottom">
        <span id="chat-character-count" className={nearLimit ? "chat-count chat-count-near" : "chat-count"}>
          {text.length}/500 caracteres
        </span>
        <Button type="submit" disabled={disabled || busy || !text.trim()}>Enviar</Button>
      </div>
    </form>
  );
}
