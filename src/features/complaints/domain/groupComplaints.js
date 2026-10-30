/**
 * Identifica grupos repetidos por cliente y tema, excluyendo temas sin clasificar.
 * @param {Object[]} quejas Quejas visibles que se analizarán.
 * @returns {{porQueja:Map,grupos:Object[]}} Grupos y relación por id de queja.
 */
export function findRepeatedCases(quejas) {
  const grouped = new Map();
  for (const complaint of quejas) {
    if (complaint.tema === "sin_clasificar") continue;
    const grupoId = `${complaint.idCliente}|${complaint.tema}`;
    if (!grouped.has(grupoId)) grouped.set(grupoId, []);
    grouped.get(grupoId).push(complaint.idQueja);
  }

  const porQueja = new Map();
  const grupos = [];
  for (const [grupoId, ids] of grouped) {
    if (ids.length < 2) continue;
    const [idCliente, tema] = grupoId.split("|");
    const grupo = { grupoId, idCliente, tema, ids: [...ids], total: ids.length };
    grupos.push(grupo);
    for (const idQueja of ids) {
      porQueja.set(idQueja, { grupoId, total: ids.length, ids: [...ids] });
    }
  }
  return { porQueja, grupos };
}
