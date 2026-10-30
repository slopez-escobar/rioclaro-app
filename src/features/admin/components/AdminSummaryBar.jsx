export default function AdminSummaryBar({ summary }) {
  const payrollRoles = summary.quienVeNominas
    .map((code) => summary.porRol.find((role) => role.codigo === code)?.nombre)
    .filter(Boolean)
    .join(" y ");

  return (
    <section className="admin-summary" aria-label="Resumen de cuentas">
      <dl className="admin-summary-cards" aria-live="polite">
        <div><dt>Cuentas</dt><dd>{summary.cuentas}</dd></div>
        <div><dt>Empleados</dt><dd>{summary.empleados}</dd></div>
        <div><dt>Clientes demo</dt><dd>{summary.clientes}</dd></div>
        <div><dt>Desactivadas</dt><dd>{summary.desactivadas}</dd></div>
        <div className="admin-payroll-summary">
          <dt>Ven nóminas</dt><dd>{payrollRoles}</dd>
        </div>
      </dl>
      <p>Soporte y sistemas administra accesos pero no ve nóminas (POL-13).</p>
      <p>En pantalla nunca se muestran contraseñas.</p>
    </section>
  );
}
