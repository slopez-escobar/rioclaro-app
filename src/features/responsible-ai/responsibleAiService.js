import { createResponsibleAiDeps } from "./responsibleAiDeps.js";
import { createChecks } from "./domain/checks.js";

function isCustomer(session) {
  return session?.rol === "cliente";
}

function protectCustomerEvidence(result, session) {
  if (!isCustomer(session) || result.tipo !== "local") return result;
  return {
    ...result,
    resumen: result.estado === "falla"
      ? "La comprobación no se completó; el detalle está reservado a personal autorizado."
      : "Comprobación ejecutada; el detalle de las sesiones de demostración está reservado a personal autorizado.",
    evidencia: [],
    nota: result.evidencia?.length
      ? "Evidencia detallada reservada a personal autorizado."
      : result.nota,
  };
}

function renderEvidenceValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

function evidenceLines(result) {
  const lines = [`### ${result.id} · ${result.titulo}`, `Estado: ${result.estado}.`];
  if (result.resumen) lines.push(result.resumen);
  if (result.nota) lines.push(result.nota);
  for (const evidence of result.evidencia || []) {
    if (evidence.tipo === "tabla") {
      lines.push("", `| ${evidence.columnas.map(renderEvidenceValue).join(" | ")} |`);
      lines.push(`| ${evidence.columnas.map(() => "---").join(" | ")} |`);
      for (const row of evidence.filas) {
        lines.push(`| ${row.map(renderEvidenceValue).join(" | ")} |`);
      }
    } else {
      lines.push(`- ${renderEvidenceValue(evidence.etiqueta)}: ${renderEvidenceValue(evidence.valor)}`);
    }
  }
  return lines;
}

/**
 * Ejecuta las verificaciones secuencialmente y mantiene evidencia solo en memoria.
 */
export function createResponsibleAiService({ createDeps = createResponsibleAiDeps } = {}) {
  let latestResults = [];

  async function runOne(check, session) {
    if (check.tipo !== "local") {
      return protectCustomerEvidence({
        ...check,
        estado: check.tipo,
        resumen: check.nota,
        evidencia: [],
      }, session);
    }
    try {
      const result = await check.run();
      return protectCustomerEvidence({
        ...check,
        ...result,
        estado: result.estado || "pasa",
      }, session);
    } catch (error) {
      const failed = {
        ...check,
        estado: "falla",
        resumen: error instanceof Error ? error.message : "La comprobación falló.",
        evidencia: [],
      };
      return protectCustomerEvidence(failed, session);
    }
  }

  return {
    async runCheck(id, session = null) {
      const deps = await createDeps();
      const check = createChecks(deps).find((item) => item.id === id);
      if (!check) throw new Error(`No existe la comprobación ${id}.`);
      const result = await runOne(check, session);
      latestResults = [...latestResults.filter((item) => item.id !== result.id), result];
      return result;
    },

    async runAll(onProgress = () => {}, session = null) {
      const deps = await createDeps();
      const checks = createChecks(deps);
      const results = [];
      for (const check of checks) {
        const checkDeps = check.tipo === "local" ? await createDeps() : deps;
        const executableCheck = check.tipo === "local"
          ? createChecks(checkDeps).find((item) => item.id === check.id)
          : check;
        const result = await runOne(executableCheck, session);
        results.push(result);
        onProgress([...results], check);
      }
      latestResults = results;
      return results;
    },

    buildEvidenceMarkdown(results = latestResults, session = null) {
      const visibleResults = results.map((result) => protectCustomerEvidence(result, session));
      const completed = visibleResults.filter((item) => item.tipo === "local");
      const pending = visibleResults.filter((item) => item.tipo === "pendiente").length;
      const manual = visibleResults.filter((item) => item.tipo === "manual").length;
      const passed = completed.filter((item) => item.estado === "pasa").length;
      const failed = completed.filter((item) => item.estado === "falla").length;
      const lines = [
        "# Evidencia de IA responsable · Río Claro",
        "",
        `Comprobaciones enumeradas: ${visibleResults.length} (${completed.length} locales, ${pending} pendientes en Azure y ${manual} manual).`,
        `Resultado local: ${passed} aprobadas, ${failed} con error, ${visibleResults.length - completed.length} pendientes/manuales.`,
        "",
        ...visibleResults.flatMap((result) => evidenceLines(result)),
        "",
      ];
      return lines.join("\n");
    },

    getCheckCatalog() {
      return createChecks({
        services: { repositories: { sucursales: { listSucursales: () => [] } } },
      }).map(({ run, ...check }) => check);
    },
  };
}

export const responsibleAiService = createResponsibleAiService();
