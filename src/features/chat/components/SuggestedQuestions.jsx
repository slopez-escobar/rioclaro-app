import { can } from "../../auth/permissions.js";

const CUSTOMER_QUESTIONS = [
  "¿Cómo va mi pedido?",
  "¿Cuánto cuesta el envío?",
  "¿Cuántos días tengo para devolver?",
  "¿Hay cloro de litro?",
];
const STOCK_QUESTIONS = [
  "¿Cuánto cloro de litro hay?",
  "¿Cuál es el precio del desinfectante de 5 litros?",
  "¿Cuál es el plazo de devoluciones?",
];
const EMPLOYEE_QUESTIONS = [
  "¿Cuál es el plazo de devoluciones?",
  "¿Cómo consulto el estado de un pedido?",
];

export default function SuggestedQuestions({ session, onSelect }) {
  const questions = session?.rol === "cliente"
    ? CUSTOMER_QUESTIONS
    : can(session?.rol, "existencias", "ver")
      ? STOCK_QUESTIONS
      : EMPLOYEE_QUESTIONS;
  return (
    <section className="chat-suggestions" aria-label="Preguntas sugeridas">
      <h2>Preguntas sugeridas</h2>
      <div className="chat-suggestion-list">
        {questions.map((question) => (
          <button type="button" className="chat-suggestion" key={question} onClick={() => onSelect(question)}>
            {question}
          </button>
        ))}
      </div>
    </section>
  );
}
