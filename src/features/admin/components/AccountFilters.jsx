import Input from "../../../shared/ui/Input.jsx";

function SelectField({ label, value, onChange, children }) {
  return (
    <label className="admin-select-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

export default function AccountFilters({ filters, roles, branches, onChange }) {
  const set = (key, value) => onChange({ ...filters, [key]: value });

  return (
    <section className="admin-filters" aria-label="Filtros de cuentas">
      <Input
        label="Buscar usuario, nombre o puesto"
        type="search"
        value={filters.texto}
        onChange={(event) => set("texto", event.target.value)}
      />
      <SelectField label="Rol" value={filters.rol} onChange={(value) => set("rol", value)}>
        <option value="todos">Todos los roles</option>
        {roles.map((role) => <option key={role.codigo} value={role.codigo}>{role.nombre}</option>)}
      </SelectField>
      <SelectField label="Sucursal" value={filters.idSucursal} onChange={(value) => set("idSucursal", value)}>
        <option value="todas">Todas las sucursales</option>
        {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.nombre}</option>)}
      </SelectField>
      <SelectField label="Estado" value={filters.estado} onChange={(value) => set("estado", value)}>
        <option value="todos">Todos los estados</option>
        <option value="activa">Activa</option>
        <option value="desactivada">Desactivada</option>
      </SelectField>
      <SelectField label="Tipo de cuenta" value={filters.tipo} onChange={(value) => set("tipo", value)}>
        <option value="todos">Todos los tipos</option>
        <option value="empleado">Empleado</option>
        <option value="cliente">Cliente demo</option>
      </SelectField>
    </section>
  );
}
