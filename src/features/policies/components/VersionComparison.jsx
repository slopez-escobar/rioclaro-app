export default function VersionComparison({ comparison, onOpenPolicy }) {
  const vigente = comparison.versiones.find(
    (version) => version.clave === comparison.vigente,
  );

  return (
    <section className="policy-comparison" aria-labelledby="policy-comparison-title">
      <h2 id="policy-comparison-title">Devoluciones: de tres versiones a una</h2>
      <div className="policy-version-cards">
        {comparison.versiones.map((version) => (
          <article
            key={version.clave}
            className={`policy-version-card${version.clave === comparison.vigente ? " is-current" : ""}`}
          >
            <div className="policy-version-heading">
              <h3>{version.etiqueta}</h3>
              {version.clave === comparison.vigente ? (
                <span className="policy-current-badge">✓ Vigente</span>
              ) : null}
            </div>
            <p><strong>Archivo:</strong> {version.archivo}</p>
            <p><strong>Versión interna:</strong> {version.version}</p>
            <p><strong>Fecha:</strong> {version.fecha}</p>
            <p><strong>Elaboró:</strong> {version.elaboro}</p>
            <p><strong>Aplica a:</strong> {version.aplicaA}</p>
          </article>
        ))}
      </div>

      <div className="policy-comparison-scroll" tabIndex="0" aria-label="Tabla de contradicciones; desplázate horizontalmente para ver todas las versiones">
        <table className="policy-comparison-table">
          <caption>Contradicciones entre las tres versiones de la política de devoluciones</caption>
          <thead>
            <tr>
              <th scope="col">Tema</th>
              {comparison.versiones.map((version) => (
                <th
                  key={version.clave}
                  scope="col"
                  className={version.clave === comparison.vigente ? "is-current" : ""}
                >
                  {version.etiqueta}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparison.contradicciones.map((item) => (
              <tr key={item.tema}>
                <th scope="row">{item.tema}</th>
                <td>{item.v1}</td>
                <td>{item.leon}</td>
                <td className="is-current">{item.v3}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="policy-current-note">
        <h3>Versión que se propone como vigente</h3>
        <p>{comparison.notaVigente}</p>
        <p>Esta es la versión que usa el asistente (POL-01, v3.0).</p>
        <button type="button" className="policy-text-button" onClick={() => onOpenPolicy("POL-01")}>
          Abrir POL-01
        </button>
      </div>
      {vigente ? <span className="sr-only">Versión vigente: {vigente.etiqueta}</span> : null}
    </section>
  );
}
