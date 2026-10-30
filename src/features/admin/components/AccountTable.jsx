import Button from "../../../shared/ui/Button.jsx";
import Tag from "../../../shared/ui/Tag.jsx";

export default function AccountTable({ accounts, disableRules, onDisable, onEnable }) {
  return (
    <div className="admin-table-scroll" tabIndex="0" aria-label="Tabla de cuentas; desplázate horizontalmente para ver todas las columnas">
      <table className="admin-table">
        <caption>Cuentas de usuario y estado de acceso. Las contraseñas no se muestran.</caption>
        <thead>
          <tr>
            <th scope="col">Usuario</th>
            <th scope="col">Nombre</th>
            <th scope="col">Puesto</th>
            <th scope="col">Rol</th>
            <th scope="col">Alcance</th>
            <th scope="col">Sucursal</th>
            <th scope="col">Estado</th>
            <th scope="col">Acción</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((account) => (
            <tr key={account.usuario}>
              <th scope="row">{account.usuario}</th>
              <td>{account.nombre}</td>
              <td>{account.puesto || "—"}</td>
              <td>{account.nombreRol}</td>
              <td>{account.alcance}</td>
              <td>{account.nombreSucursal}</td>
              <td>
                {account.estado === "desactivada" ? (
                  <span className="admin-state-detail">
                    <Tag variant="revisar">⚠ Desactivada</Tag>
                    <small>{account.desde} · por {account.por}</small>
                    <small>Motivo: {account.motivo}</small>
                  </span>
                ) : <Tag variant="ok">✓ Activa</Tag>}
              </td>
              <td className="admin-account-action">
                {account.estado === "desactivada" ? (
                  <Button variant="secondary" onClick={() => onEnable(account)}>
                    Reactivar
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      disabled={!disableRules[account.usuario]?.permitido}
                      title={disableRules[account.usuario]?.motivo || undefined}
                      onClick={() => onDisable(account)}
                    >
                      Desactivar
                    </Button>
                    {!disableRules[account.usuario]?.permitido ? (
                      <small>{disableRules[account.usuario]?.motivo}</small>
                    ) : null}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
