import { can } from "../auth/permissions.js";
import { canSeeQueja } from "../../data/scope.js";
import { sucursales } from "../../config/sucursales.js";
import * as clientesRepository from "../../data/repositories/clientesRepository.js";
import * as quejasRepository from "../../data/repositories/quejasRepository.js";
import { complaintActionsRepository } from "./complaintActionsRepository.js";
import { complaintRepository } from "./complaintRepository.js";
import { USE_AZURE } from "../../config/env.js";
import {
  applyAction,
  canAct,
  canAttend,
  evaluateFirstResponse,
  findRepeatedCases,
  replayActions,
  sortComplaints,
} from "./domain/index.js";
import { sentiment as defaultSentiment } from "./services/sentiment.js";
import { createMockSentiment } from "./services/sentiment.mock.js";
import { formatLocalMinute } from "../../shared/utils/time.js";

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX");
}

function matchesFilters(queja, filtros) {
  const fecha = String(queja.fechaQueja || "").slice(0, 10);
  const searchText = normalizeText([
    queja.descripcion,
    queja.folio,
    queja.folioPedido,
    queja.clienteNombre,
  ].join(" "));
  const requestedText = normalizeText(filtros.texto);
  return (filtros.estatus == null || queja.estatus === filtros.estatus)
    && (filtros.tema == null || queja.tema === filtros.tema)
    && (filtros.prioridad == null || queja.prioridad === filtros.prioridad)
    && (filtros.idSucursal == null
      || queja.idSucursal === filtros.idSucursal
      || queja.idSucursalSurtido === filtros.idSucursal)
    && (filtros.casoRepetido == null
      || queja.casoRepetido === Boolean(filtros.casoRepetido))
    && (filtros.surtidoEnOtraSucursal == null
      || queja.surtidoEnOtraSucursal === Boolean(filtros.surtidoEnOtraSucursal))
    && (filtros.desde == null || fecha >= filtros.desde)
    && (filtros.hasta == null || fecha <= filtros.hasta)
    && (!requestedText || searchText.includes(requestedText));
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Crea los servicios de consulta y atención de quejas con dependencias inyectables.
 * @param {Object} options Repositorios, analizador de sentimiento y reloj.
 * @returns {Object} Operaciones de lectura, atención, métricas y reinicio.
 */
export function createComplaintService({
  quejasRepo = quejasRepository,
  complaintRepo = complaintRepository,
  actionsRepo = complaintActionsRepository,
  clientesRepo = clientesRepository,
  sentiment = defaultSentiment,
  estimatedSentiment = createMockSentiment(),
  azureMode = USE_AZURE,
  now = () => formatLocalMinute(new Date()),
} = {}) {
  const sentimentCache = new Map();
  let analysisQueue = Promise.resolve();

  function getSentiment(queja) {
    if (!sentimentCache.has(queja.idQueja)) {
      const result = analysisQueue.then(() => (
        typeof sentiment.analyzeForComplaint === "function"
          ? sentiment.analyzeForComplaint(queja.idQueja, queja.descripcion)
          : sentiment.analyze(queja.descripcion)
      ));
      analysisQueue = result.then(() => undefined, () => undefined);
      sentimentCache.set(queja.idQueja, result);
    }
    return sentimentCache.get(queja.idQueja);
  }

  async function getEstimatedSentiment(queja) {
    const result = await estimatedSentiment.analyze(queja.descripcion);
    return azureMode ? { ...result, origen: "estimado" } : result;
  }

  async function getClientName(session, idCliente) {
    if (!can(session?.rol, "clientes", "ver")) return null;
    try {
      const cliente = await clientesRepo.getCliente(session, idCliente);
      return cliente?.nombreComercial || cliente?.razonSocial || null;
    } catch (error) {
      if (error instanceof Error && error.message === "No tienes permiso para ver clientes") {
        return null;
      }
      throw error;
    }
  }

  async function collectVisible(session) {
    const base = await quejasRepo.listQuejas(session);
    const newComplaints = (await complaintRepo.listNuevas())
      .filter((queja) => canSeeQueja(session, queja));
    const actions = actionsRepo.listAll();
    return [...base, ...newComplaints].map((queja) =>
      replayActions(queja, actions[queja.idQueja] || []),
    );
  }

  async function enrich(session, complaints, repeatedCases = null, { analyzeRemotely = false } = {}) {
    const repeated = repeatedCases || findRepeatedCases(complaints);
    const timestamp = now();
    return Promise.all(complaints.map(async (queja) => {
      const repeatInfo = repeated.porQueja.get(queja.idQueja) || null;
      const [sentimentResult, clienteNombre] = await Promise.all([
        azureMode
          ? (analyzeRemotely ? getSentiment(queja) : getEstimatedSentiment(queja))
          : getSentiment(queja),
        getClientName(session, queja.idCliente),
      ]);
      return {
        ...queja,
        sentimiento: sentimentResult,
        primeraRespuesta: evaluateFirstResponse(queja, timestamp),
        repetido: repeatInfo,
        casoRepetido: Boolean(repeatInfo),
        quejasRelacionadas: repeatInfo
          ? repeatInfo.ids.filter((id) => id !== queja.idQueja)
          : [],
        acuseAutomatico: queja.canal === "asistente",
        clienteNombre,
        sucursalNombre: sucursales.find((sucursal) => sucursal.id === queja.idSucursal)?.nombre || queja.idSucursal,
        sucursalSurtidoNombre: queja.idSucursalSurtido
          ? sucursales.find((sucursal) => sucursal.id === queja.idSucursalSurtido)?.nombre || queja.idSucursalSurtido
          : null,
        accionesPermitidas: Object.fromEntries(
          ["responder", "escalar", "resolver", "cerrar"]
            .map((accion) => [accion, canAct(session, queja, accion)]),
        ),
      };
    }));
  }

  async function list(session, filtros = {}) {
    const visible = await collectVisible(session);
    const enriched = await enrich(session, visible);
    return sortComplaints(enriched.filter((queja) => matchesFilters(queja, filtros)));
  }

  async function get(session, idQueja) {
    const complaints = await collectVisible(session);
    const target = complaints.find((queja) => queja.idQueja === idQueja);
    if (!target) return null;
    const [enriched] = await enrich(
      session,
      [target],
      findRepeatedCases(complaints),
      { analyzeRemotely: true },
    );
    return enriched;
  }

  async function act(session, idQueja, { accion, comentario, calificacion } = {}) {
    const current = await get(session, idQueja);
    if (!current) return null;
    const decision = canAct(session, current, accion);
    if (!decision.permitido) throw new Error(decision.motivo);

    const fecha = now();
    applyAction(current, {
      accion,
      session,
      comentario,
      calificacion,
      ahora: fecha,
    });
    actionsRepo.append(idQueja, {
      accion,
      comentario,
      calificacion,
      fecha,
      usuario: session.usuario,
      rol: session.rol,
      idEmpleado: session.idEmpleado,
      nombre: session.nombre,
      puesto: session.puesto,
    });
    return get(session, idQueja);
  }

  async function kpis(session) {
    const complaints = await list(session);
    const porEstatus = {
      cerrada: 0,
      resuelta: 0,
      escalada: 0,
      abierta: 0,
      en_atencion: 0,
    };
    const porPrioridad = { baja: 0, media: 0, alta: 0 };
    const responses = [];
    for (const queja of complaints) {
      if (Object.hasOwn(porEstatus, queja.estatus)) porEstatus[queja.estatus] += 1;
      if (Object.hasOwn(porPrioridad, queja.prioridad)) porPrioridad[queja.prioridad] += 1;
      if (queja.fechaPrimeraRespuesta) responses.push(queja.tiempoPrimeraRespuestaMin);
    }
    const cumplen15 = complaints.filter((queja) =>
      queja.fechaPrimeraRespuesta && queja.tiempoPrimeraRespuestaMin <= 15).length;
    const porcentaje = responses.length ? Math.round((cumplen15 / responses.length) * 100) : 0;
    return {
      total: complaints.length,
      porEstatus,
      porPrioridad,
      casosRepetidos: complaints.filter((queja) => queja.casoRepetido).length,
      gruposRepetidos: findRepeatedCases(complaints).grupos.length,
      primeraRespuesta: {
        conRespuesta: responses.length,
        cumplen15,
        porcentaje,
        medianaMinutos: median(responses),
      },
      vencidasSinRespuesta: complaints.filter((queja) =>
        !queja.fechaPrimeraRespuesta && queja.primeraRespuesta.estado === "vencida").length,
      acusesAutomaticos: complaints.filter((queja) => queja.acuseAutomatico).length,
    };
  }

  async function repeatedGroups(session) {
    const complaints = await list(session);
    const complaintsById = new Map(complaints.map((queja) => [queja.idQueja, queja]));
    return findRepeatedCases(complaints).grupos.map((group) => {
      const firstComplaint = complaintsById.get(group.ids[0]);
      return {
        ...group,
        clienteNombre: firstComplaint?.clienteNombre || group.idCliente,
        folios: group.ids.map((idQueja) => ({
          idQueja,
          folio: complaintsById.get(idQueja)?.folio || idQueja,
        })),
      };
    });
  }

  function branchOptions(session) {
    if (session?.alcance !== "todas") return [];
    return sucursales.map(({ id, nombre }) => ({ id, nombre }));
  }

  async function reset(session) {
    if (!canAttend(session)) throw new Error("Tu rol no puede atender quejas");
    actionsRepo.reset();
    await complaintRepo.clear();
    sentimentCache.clear();
    sentiment.clearCache?.();
    return list(session);
  }

  return { list, get, act, kpis, repeatedGroups, branchOptions, reset };
}

export const complaintService = createComplaintService();
