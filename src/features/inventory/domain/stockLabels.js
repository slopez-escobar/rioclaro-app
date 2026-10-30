export const ESTATUS_LABEL = {
  agotado: "Agotado",
  bajo: "Stock bajo",
  normal: "Normal",
  exceso: "Exceso",
};

export const ESTATUS_VARIANT = {
  agotado: { variant: "rechazada", symbol: "×" },
  bajo: { variant: "revisar", symbol: "!" },
  normal: { variant: "ok", symbol: "✓" },
  exceso: { variant: "info", symbol: "↑" },
};

export const ESTATUS_ORDEN = ["agotado", "bajo", "normal", "exceso"];
