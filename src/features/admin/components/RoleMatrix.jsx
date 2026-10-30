export default function RoleMatrix({ matrix }) {
  return (
    <div className="admin-table-scroll" tabIndex="0" aria-label="Matriz de permisos; desplázate horizontalmente para ver todos los roles">
      <table className="admin-table admin-role-matrix">
        <caption>Módulos, acciones y alcance permitido por rol</caption>
        <thead>
          <tr>
            <th scope="col">Módulo</th>
            {matrix.roles.map((role) => (
              <th key={role.codigo} scope="col">
                {role.nombre}<small>Alcance: {role.alcance}</small>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.modulos.map((module) => (
            <tr
              key={module.codigo}
              className={module.codigo === "nominas" ? "admin-payroll-row" : ""}
            >
              <th scope="row">{module.nombre}</th>
              {matrix.roles.map((role) => {
                const actions = module.permisos[role.codigo] || [];
                return (
                  <td key={role.codigo}>
                    {actions.length ? actions.join(", ") : <span aria-label="Sin permisos">—</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
