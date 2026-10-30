/** Devuelve el valor de un campo extraído o el valor directo. */
export function invoiceFieldValue(field) {
  return field !== null && typeof field === "object" && Object.hasOwn(field, "valor")
    ? field.valor
    : field ?? null;
}
