// Constantes del proyecto. Un solo lugar para umbrales y claves de localStorage.
export const CONFIDENCE_THRESHOLD = 0.8; // bajo este nivel, la factura pasa a revisión humana
export const STORAGE_PREFIX = "rc:v1:";
export const STORAGE_KEYS = {
  session: "session",
  invoices: "invoices",
  chat: "chat",
  disabledAccounts: "disabledAccounts",
  adminAudit: "adminAudit",
  complaints: "complaints",
  complaintActions: "complaintActions",
};
export const FIRST_RESPONSE_TARGET_MIN = 15; // objetivo de primera respuesta a quejas
export const MIN_COMMENT_REPLY = 5;
export const MIN_COMMENT_ESCALATE = 10;
export const MIN_COMMENT_RESOLVE = 20;
export const FINAL_RESPONSE_TARGET_BUSINESS_DAYS = 3;
// Supuestos del prototipo para estimar trabajo humano; no son mediciones.
export const MIN_REVIEW = 3;
export const MIN_OK = 1;
export const MIN_DUPLICATE = 1;
export const DIRECTION_APPROVAL_THRESHOLD = 100000;
export const MIN_COMMENT_REJECT = 5;
export const MIN_COMMENT_RELEASE = 10;
export const WEEKLY_MANUAL_HOURS_BASELINE = 12;
export const INVOICES_SCHEMA_VERSION = 1;
