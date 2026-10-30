import { WEEKLY_MANUAL_HOURS_BASELINE } from "../../config/constants.js";
import { can } from "../auth/permissions.js";
import { hashFile as defaultHashFile } from "../../shared/utils/hashFile.js";
import { estimateHumanMinutes } from "./domain/estimateHumanMinutes.js";
import { evaluateInvoice } from "./domain/evaluateInvoice.js";
import { applyDecision, pendingApprovals } from "./domain/invoiceDecisions.js";
import { createInvoiceRecord } from "./domain/invoiceModel.js";
import { invoiceRepository } from "./invoiceRepository.js";
import { listProveedores } from "../../data/repositories/proveedoresRepository.js";
import { extractor as defaultExtractor } from "./services/extractor.js";

const EMPTY_EXTRACTION = {
  proveedor: { valor: null, confianza: 0 },
  rfc: { valor: null, confianza: 0 },
  folio: { valor: null, confianza: 0 },
  fecha: { valor: null, confianza: 0 },
  total: { valor: null, confianza: 0 },
};
const FINAL_STATES = new Set(["Aprobada", "Rechazada"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const BASE_URL = import.meta.env.BASE_URL;

function getValue(field) {
  return field !== null && typeof field === "object" && Object.hasOwn(field, "valor")
    ? field.valor
    : field;
}

function sampleMimeType(format) {
  switch (String(format).toLowerCase()) {
    case "pdf":
      return "application/pdf";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    default:
      return "application/octet-stream";
  }
}

async function defaultFetchSample(url) {
  return fetch(url);
}

/**
 * Crea el servicio que coordina extracción, evaluación, persistencia y decisiones.
 * @param {Object} dependencies Dependencias de infraestructura inyectables.
 * @returns {Object} Operaciones de aplicación de facturas.
 */
export function createInvoiceService({
  extractor,
  repository,
  proveedores,
  hashFile = defaultHashFile,
  now = () => new Date().toISOString(),
  fetchSample = defaultFetchSample,
}) {
  async function processFile(file, session) {
    if (!can(session?.rol, "facturas_proveedores", "crear")) {
      throw new Error("No tienes permiso para subir facturas");
    }

    const extension = /\.([^.]+)$/.exec(file?.name ?? "")?.[1]?.toLowerCase();
    if (!["pdf", "jpg", "jpeg", "png"].includes(extension)) {
      throw new Error("Formato no admitido (usa PDF, JPG o PNG)");
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new Error("El archivo supera 10 MB");
    }

    const hash = await hashFile(file);
    let extraction;
    let extractionFailed = false;
    try {
      extraction = await extractor.extractInvoice(file);
    } catch {
      extraction = {
        proveedor: { ...EMPTY_EXTRACTION.proveedor },
        rfc: { ...EMPTY_EXTRACTION.rfc },
        folio: { ...EMPTY_EXTRACTION.folio },
        fecha: { ...EMPTY_EXTRACTION.fecha },
        total: { ...EMPTY_EXTRACTION.total },
      };
      extractionFailed = true;
    }

    const existing = repository.list().reverse();
    const evaluation = evaluateInvoice(
      extraction,
      { nombre: file.name, hash },
      { proveedores: await proveedores(), existentes: existing },
    );
    if (extractionFailed) {
      evaluation.estado = "Revisar";
      evaluation.motivos = [...evaluation.motivos, "No se pudo leer automáticamente"];
    }

    const uploadedAt = now();
    const record = createInvoiceRecord({
      id: repository.nextId(),
      extraccion: extraction,
      archivo: { nombre: file.name, hash },
      evaluacion: evaluation,
      subidaPor: session.usuario,
      subidaEn: uploadedAt,
    });
    record.historial = [{
      fecha: uploadedAt,
      accion: "subida",
      usuario: session.usuario,
      rol: session.rol,
      nombre: session.nombre,
      comentario: null,
    }];
    return repository.add(record);
  }

  /**
   * Procesa varios archivos secuencialmente y comunica el resultado de cada uno.
   * @param {File[]} files Archivos por procesar.
   * @param {Object} session Sesión activa.
   * @param {Function} onProgress Notificador opcional de progreso.
   * @returns {Promise<{creados: Object[], errores: Object[]}>} Resultados del lote.
   */
  async function processFiles(files, session, onProgress = () => {}) {
    const created = [];
    const errors = [];
    const total = files.length;

    for (const [index, file] of files.entries()) {
      let record = null;
      let error = null;
      try {
        record = await processFile(file, session);
        created.push(record);
      } catch (processingError) {
        error = processingError instanceof Error
          ? processingError.message
          : String(processingError);
        errors.push({ archivo: file?.name ?? "", error });
      }
      onProgress({
        actual: index + 1,
        total,
        archivo: file?.name ?? "",
        estado: record?.estado ?? null,
        error,
      });
    }

    return { creados: created, errores: errors };
  }

  /**
   * Aplica una decisión humana y persiste la factura actualizada.
   * @param {string} id Identificador de la factura.
   * @param {Object} decision Acción y comentario.
   * @param {Object} session Sesión que decide.
   * @returns {Object} Factura actualizada.
   */
  function decide(id, { accion, comentario }, session) {
    const invoice = repository.getById(id);
    if (!invoice) throw new Error("La factura no existe");
    const timestamp = now();
    return repository.update(id, (current) =>
      applyDecision(current, { accion, comentario, session, ahora: timestamp }),
    );
  }

  /**
   * Resume estados y estimaciones de trabajo humano de las facturas.
   * @returns {Object} Conteos y estimaciones de carga de trabajo.
   */
  function summary() {
    const invoices = repository.list();
    const porEstado = {
      OK: 0,
      Revisar: 0,
      Duplicada: 0,
      Aprobada: 0,
      Rechazada: 0,
    };
    for (const invoice of invoices) {
      if (Object.hasOwn(porEstado, invoice.estado)) porEstado[invoice.estado] += 1;
    }

    const humanTime = estimateHumanMinutes(invoices);
    const pendientesDeDireccion = invoices.filter(
      (invoice) =>
        !FINAL_STATES.has(invoice.estado)
        && pendingApprovals(invoice).includes("direccion"),
    ).length;
    const porcentajeReduccion = WEEKLY_MANUAL_HOURS_BASELINE === 0
      ? 0
      : ((WEEKLY_MANUAL_HOURS_BASELINE - humanTime.horas)
        / WEEKLY_MANUAL_HOURS_BASELINE) * 100;

    return {
      porEstado,
      pendientesDeDireccion,
      minutosHumanosEstimados: humanTime.minutos,
      horasHumanasEstimadas: humanTime.horas,
      horasLineaBase: WEEKLY_MANUAL_HOURS_BASELINE,
      porcentajeReduccion,
    };
  }

  /**
   * Descarga y procesa las facturas de prueba en el orden del manifiesto.
   * @param {Object} session Sesión activa.
   * @param {Function} onProgress Notificador opcional de progreso.
   * @returns {Promise<{creados: Object[], errores: Object[]}>} Resultados del lote.
   */
  async function loadSampleInvoices(session, onProgress = () => {}) {
    const manifestUrl = `${BASE_URL}facturas-prueba/manifest.json`;
    const manifestResponse = await fetchSample(manifestUrl);
    if (!manifestResponse.ok) {
      throw new Error(`No se pudo cargar el manifiesto de facturas (${manifestResponse.status})`);
    }
    const manifest = await manifestResponse.json();
    if (!Array.isArray(manifest?.facturas)) {
      throw new Error("El manifiesto de facturas no contiene una lista válida.");
    }

    const files = [];
    for (const invoice of manifest.facturas) {
      const fileUrl = `${BASE_URL}facturas-prueba/${encodeURIComponent(invoice.archivo)}`;
      const response = await fetchSample(fileUrl);
      if (!response.ok) {
        throw new Error(`No se pudo cargar el archivo de prueba ${invoice.archivo} (${response.status})`);
      }
      const blob = await response.blob();
      files.push(new File(
        [blob],
        invoice.archivo,
        { type: blob.type || sampleMimeType(invoice.formato) },
      ));
    }

    return processFiles(files, session, onProgress);
  }

  return {
    processFile,
    processFiles,
    decide,
    summary,
    loadSampleInvoices,
  };
}

/** Servicio de facturas de la aplicación con dependencias reales. */
export const invoiceService = createInvoiceService({
  extractor: defaultExtractor,
  repository: invoiceRepository,
  proveedores: listProveedores,
  hashFile: defaultHashFile,
});
