// variant: ok | revisar | duplicada | aprobada | rechazada | info
export default function Tag({ variant = "info", children }) {
  return <span className={`tag tag-${variant}`}>{children}</span>;
}
