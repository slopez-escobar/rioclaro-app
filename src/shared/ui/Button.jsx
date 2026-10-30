export default function Button({ variant = "primary", type = "button", className = "", ...props }) {
  return <button type={type} className={`btn btn-${variant} ${className}`.trim()} {...props} />;
}
