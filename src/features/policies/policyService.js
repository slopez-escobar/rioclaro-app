import { getVersiones } from "../../data/repositories/devolucionesVersionesRepository.js";
import { policiesAllowed } from "../chat/domain/accessPolicy.js";
import { loadKnowledgeBase } from "../chat/knowledge/knowledgeBase.js";
import { normalizeText } from "../../data/repositories/repositoryUtils.js";

function responsibleFor(policy) {
  const responsible = policy.responsableIndice;
  if (!responsible?.nombre || !responsible?.puesto) {
    throw new Error(`Faltan los datos de responsable en el índice de ${policy.id}.`);
  }
  return { nombre: responsible.nombre, puesto: responsible.puesto };
}

function searchableText(policy) {
  return [
    policy.titulo,
    policy.proposito,
    ...policy.reglas.map((rule) => `${rule.tema} ${rule.texto}`),
  ].join(" ");
}

function searchRank(policy, query) {
  const title = normalizeText(policy.titulo);
  const purpose = normalizeText(policy.proposito);
  if (title.includes(query)) return 0;
  if (purpose.includes(query)) return 1;
  return 2;
}

function comparePolicyIds(left, right) {
  return Number(left.id.slice(4)) - Number(right.id.slice(4));
}

/**
 * Crea el servicio de consulta de políticas y comparación de devoluciones.
 * @param {Object} dependencies Fuentes de conocimiento y repositorio de comparación.
 */
export function createPolicyService({
  knowledge = { loadKnowledgeBase, policiesAllowed },
  versionesRepo = { getVersiones },
} = {}) {
  async function allowedPolicies(session) {
    const { politicas } = await knowledge.loadKnowledgeBase();
    return knowledge.policiesAllowed(session, politicas);
  }

  return {
    async listPolicies(session, { texto = "", audiencia = "todas" } = {}) {
      const policies = await allowedPolicies(session);
      const query = normalizeText(texto.trim());
      return policies
        .filter((policy) => audiencia === "todas" || policy.audiencia === audiencia)
        .filter((policy) => !query || normalizeText(searchableText(policy)).includes(query))
        .sort((left, right) =>
          (query ? searchRank(left, query) - searchRank(right, query) : 0)
          || comparePolicyIds(left, right),
        )
        .map((policy) => ({
          id: policy.id,
          titulo: policy.titulo,
          version: policy.version,
          vigenteDesde: policy.vigenteDesde,
          audiencia: policy.audiencia,
          responsable: responsibleFor(policy),
          resumen: policy.proposito,
        }));
    },

    async getPolicy(session, id) {
      const policy = (await allowedPolicies(session)).find((item) => item.id === id);
      if (!policy) return null;
      return {
        ...policy,
        responsable: responsibleFor(policy),
      };
    },

    getComparison(session) {
      return versionesRepo.getVersiones(session);
    },
  };
}

export const policyService = createPolicyService();
