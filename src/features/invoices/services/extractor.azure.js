import { apiClient } from "../../../shared/api/apiClient.js";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MIME_TYPES = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };
const FIELD_NAMES = ["proveedor", "rfc", "folio", "fecha", "total"];

function toBase64(bytes) {
  const chunks = [];
  const blockSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += blockSize) {
    const block = bytes.subarray(offset, Math.min(offset + blockSize, bytes.length));
    let binary = "";
    for (let index = 0; index < block.length; index += 1) binary += String.fromCharCode(block[index]);
    chunks.push(binary);
  }
  return btoa(chunks.join(""));
}

function validField(field) {
  return field
    && Object.hasOwn(field, "valor")
    && typeof field.confianza === "number"
    && Number.isFinite(field.confianza)
    && field.confianza >= 0
    && field.confianza <= 1;
}

/** Crea el extractor remoto de Azure Document Intelligence. */
export function createAzureExtractor({ client = apiClient } = {}) {
  return {
    async extractInvoice(file) {
      const extension = /\.([^.]+)$/.exec(file?.name ?? "")?.[1]?.toLowerCase();
      if (!Object.hasOwn(MIME_TYPES, extension)) {
        throw new Error("Formato no admitido (usa PDF, JPG o PNG)");
      }
      if (!Number.isFinite(file?.size) || file.size > MAX_FILE_SIZE) {
        throw new Error("El archivo supera 10 MB");
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      const payload = await client.request("/extractInvoice", {
        method: "POST",
        body: {
          nombre: file.name,
          tipo: file.type || MIME_TYPES[extension],
          base64: toBase64(bytes),
        },
      });
      if (!FIELD_NAMES.every((field) => validField(payload?.[field]))) {
        throw new Error("Respuesta inesperada del servicio de lectura de facturas.");
      }
      return {
        proveedor: payload.proveedor,
        rfc: payload.rfc,
        folio: payload.folio,
        fecha: payload.fecha,
        total: payload.total,
        meta: payload.meta ?? {},
      };
    },
  };
}
