export default function EvidenceTable({ evidencia = [] }) {
  if (!evidencia.length) return null;
  return (
    <div className="rai-evidence">
      {evidencia.map((item, index) => (
        item.tipo === "tabla" ? (
          <div className="rai-table-scroll" key={`${item.columnas.join("-")}-${index}`} tabIndex="0">
            <table>
              <caption className="sr-only">Evidencia de la comprobación</caption>
              <thead>
                <tr>{item.columnas.map((column) => <th key={column} scope="col">{column}</th>)}</tr>
              </thead>
              <tbody>
                {item.filas.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => <td key={cellIndex}>{cell ?? "—"}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <dl className="rai-evidence-pair" key={`${item.etiqueta}-${index}`}>
            <dt>{item.etiqueta}</dt>
            <dd>{item.valor}</dd>
          </dl>
        )
      ))}
    </div>
  );
}
