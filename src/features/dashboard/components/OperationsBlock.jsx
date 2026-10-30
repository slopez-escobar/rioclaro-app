import PanelBlock from "./PanelBlock.jsx";

export default function OperationsBlock({ block, detailLinks }) {
  if (block?.estado !== "ok") {
    return <PanelBlock title="Operación" block={block} detailLinks={detailLinks} />;
  }
  const data = block.datos;
  return (
    <PanelBlock title="Operación" block={block} detailLinks={detailLinks}>
      <dl className="panel-metrics">
        <div><dt>Productos-sucursal agotados</dt><dd>{data.agotados}</dd></div>
        <div><dt>Productos-sucursal con stock bajo</dt><dd>{data.bajos}</dd></div>
        <div><dt>Pedidos en curso</dt><dd>{data.pedidosEnCurso}</dd></div>
        <div><dt>Pedidos surtidos desde otra sucursal</dt><dd>{data.pedidosSurtidosDesdeOtraSucursal}</dd></div>
      </dl>
      <p className="panel-assumption">Corte de existencias: {data.fechaCorte}</p>
    </PanelBlock>
  );
}
