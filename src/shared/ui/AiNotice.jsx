import { AI_NOTICE_DEFAULT } from "../../features/chat/domain/guidelines.js";

export { AI_NOTICE_DEFAULT };

export default function AiNotice({ children }) {
  return (
    <p className="aviso-ia" role="note">
      {children || AI_NOTICE_DEFAULT}
    </p>
  );
}
