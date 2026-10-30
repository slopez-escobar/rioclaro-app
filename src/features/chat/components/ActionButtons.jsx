import Button from "../../../shared/ui/Button.jsx";

export default function ActionButtons({ contact, onComplaint, onContact, canCreateComplaint }) {
  return (
    <div className="chat-footer-actions">
      <Button variant="secondary" onClick={() => onContact(contact)}>Hablar con una persona</Button>
      {canCreateComplaint ? <Button variant="secondary" onClick={onComplaint}>Registrar mi queja</Button> : null}
    </div>
  );
}
