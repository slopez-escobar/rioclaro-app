import { describe, expect, it } from "vitest";
import { DIRECTION_APPROVAL_THRESHOLD } from "../src/config/constants.js";
import { can } from "../src/features/auth/permissions.js";
import {
  applyDecision,
  canDecide,
  pendingApprovals,
  requiredApprovals,
} from "../src/features/invoices/domain/index.js";
import { roles } from "../src/features/auth/data/roles.json";

const rolesPorCodigo = new Map(roles.map((role) => [role.codigo, role]));
const session = (rol, usuario = `usuario-${rol}`) => ({
  usuario,
  nombre: `Persona ${usuario}`,
  rol,
});
const factura = (overrides = {}) => ({
  id: "FAC-TEST",
  estado: "OK",
  total: 25000,
  motivos: [],
  duplicadoDe: null,
  aprobaciones: [],
  historial: [],
  decididaPor: null,
  decididaEn: null,
  ...overrides,
});
const ahora = "2026-10-27T16:00:00.000Z";

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

describe("requisitos de aprobación", () => {
  it("usa solo Finanzas hasta el umbral estricto de $100,000.00", () => {
    expect(requiredApprovals(DIRECTION_APPROVAL_THRESHOLD)).toEqual(["finanzas"]);
    expect(requiredApprovals(DIRECTION_APPROVAL_THRESHOLD + 0.01)).toEqual([
      "finanzas",
      "direccion",
    ]);
  });

  it("requiere dos personas distintas por encima del umbral", () => {
    expect(
      pendingApprovals({
        total: 100000.01,
        aprobaciones: [{ rol: "finanzas", usuario: "laura" }],
      }),
    ).toEqual(["direccion"]);
    expect(
      pendingApprovals({
        total: 100000.01,
        aprobaciones: [{ rol: "direccion", usuario: "ernesto" }],
      }),
    ).toEqual(["finanzas"]);
    expect(
      pendingApprovals({
        total: 100000.01,
        aprobaciones: [
          { rol: "direccion", usuario: "ernesto" },
          { rol: "finanzas", usuario: "ernesto" },
        ],
      }),
    ).toEqual(["finanzas"]);
  });

  it("ignora aprobaciones duplicadas de la misma persona", () => {
    expect(
      pendingApprovals({
        total: 50000,
        aprobaciones: [
          { rol: "finanzas", usuario: "laura" },
          { rol: "direccion", usuario: "laura" },
        ],
      }),
    ).toEqual([]);
    expect(
      pendingApprovals({
        total: 100001,
        aprobaciones: [
          { rol: "finanzas", usuario: "laura" },
          { rol: "finanzas", usuario: "laura" },
        ],
      }),
    ).toEqual(["direccion"]);
  });
});

describe("canDecide", () => {
  it.each(["finanzas", "direccion"])("%s puede decidir según permisos reales", (rol) => {
    expect(can(rol, "facturas_proveedores", "aprobar")).toBe(true);
    expect(canDecide(session(rol), factura(), "aprobar")).toEqual({
      permitido: true,
      motivo: null,
    });
    expect(canDecide(session(rol), factura(), "rechazar")).toEqual({
      permitido: true,
      motivo: null,
    });
    expect(canDecide(session(rol), factura({ estado: "Duplicada" }), "liberar")).toEqual({
      permitido: true,
      motivo: null,
    });
  });

  it.each(["compras", "ventas", "cliente"])(
    "deniega a %s aunque intente cualquier decisión",
    (rol) => {
      expect(can(rol, "facturas_proveedores", "aprobar")).toBe(false);
      for (const accion of ["aprobar", "rechazar", "liberar"]) {
        expect(canDecide(session(rol), factura({ estado: "Duplicada" }), accion)).toEqual({
          permitido: false,
          motivo: "No tienes permiso para decidir sobre facturas",
        });
      }
    },
  );

  it.each(["Aprobada", "Rechazada"])("niega cambios a una factura %s", (estado) => {
    expect(canDecide(session("finanzas"), factura({ estado }), "rechazar")).toEqual({
      permitido: false,
      motivo: "La factura ya tiene una decisión final",
    });
  });

  it("niega aprobar duplicadas, repetir aprobación o liberar una factura no duplicada", () => {
    const finance = session("finanzas", "laura");
    expect(canDecide(finance, factura({ estado: "Duplicada" }), "aprobar")).toEqual({
      permitido: false,
      motivo: "Una factura duplicada debe liberarse antes de aprobarla",
    });
    expect(
      canDecide(
        finance,
        factura({ aprobaciones: [{ rol: "finanzas", usuario: "laura" }] }),
        "aprobar",
      ),
    ).toEqual({ permitido: false, motivo: "Ya registraste tu aprobación" });
    expect(canDecide(finance, factura(), "liberar")).toEqual({
      permitido: false,
      motivo: "Solo se puede liberar una factura duplicada",
    });
  });

  it("rechaza acciones que no pertenecen al contrato", () => {
    expect(canDecide(session("finanzas"), factura(), "pagar")).toEqual({
      permitido: false,
      motivo: "La acción de decisión no es válida",
    });
  });
});

describe("applyDecision", () => {
  it("aprueba al llegar al umbral y registra la decisión e historial", () => {
    const input = deepFreeze(factura({ total: 100000 }));
    const result = applyDecision(input, {
      accion: "aprobar",
      session: session("finanzas", "laura"),
      ahora,
    });

    expect(result).not.toBe(input);
    expect(result).toMatchObject({
      estado: "Aprobada",
      decididaPor: "laura",
      decididaEn: ahora,
      aprobaciones: [
        { rol: "finanzas", usuario: "laura", nombre: "Persona laura", fecha: ahora },
      ],
      historial: [
        {
          fecha: ahora,
          accion: "aprobar",
          usuario: "laura",
          rol: "finanzas",
          nombre: "Persona laura",
          comentario: null,
        },
      ],
    });
    expect(input.estado).toBe("OK");
    expect(input.aprobaciones).toEqual([]);
  });

  it("mantiene pendiente y completa en orden inverso las dos aprobaciones", () => {
    const original = deepFreeze(
      factura({ total: 100000.01, estado: "Revisar", motivos: ["Validación manual"] }),
    );
    const first = applyDecision(original, {
      accion: "aprobar",
      session: session("direccion", "ernesto"),
      comentario: "Revisado por Dirección",
      ahora,
    });
    expect(first.estado).toBe("Revisar");
    expect(first.decididaPor).toBeNull();
    expect(pendingApprovals(first)).toEqual(["finanzas"]);

    const completed = applyDecision(first, {
      accion: "aprobar",
      session: session("finanzas", "laura"),
      comentario: "Validación de Finanzas",
      ahora: "2026-10-27T16:05:00.000Z",
    });
    expect(completed.estado).toBe("Aprobada");
    expect(completed.decididaPor).toBe("laura");
    expect(pendingApprovals(completed)).toEqual([]);
    expect(completed.historial).toHaveLength(2);
    expect(completed.historial[0]).toMatchObject({
      accion: "aprobar",
      usuario: "ernesto",
      rol: "direccion",
      comentario: "Revisado por Dirección",
    });
    expect(completed.historial[1]).toMatchObject({
      accion: "aprobar",
      usuario: "laura",
      rol: "finanzas",
      comentario: "Validación de Finanzas",
    });
    expect(original).toMatchObject({ estado: "Revisar", aprobaciones: [], historial: [] });
  });

  it("también completa primero con Finanzas y después con Dirección", () => {
    const initial = factura({ total: 100000.01 });
    const financeApproval = applyDecision(initial, {
      accion: "aprobar",
      session: session("finanzas", "laura"),
      ahora,
    });
    expect(financeApproval.estado).toBe("OK");
    expect(pendingApprovals(financeApproval)).toEqual(["direccion"]);

    const completed = applyDecision(financeApproval, {
      accion: "aprobar",
      session: session("direccion", "ernesto"),
      ahora: "2026-10-27T16:05:00.000Z",
    });
    expect(completed.estado).toBe("Aprobada");
    expect(completed.decididaPor).toBe("ernesto");
    expect(pendingApprovals(completed)).toEqual([]);
  });

  it("exige comentario para aprobar en revisión, rechazar y liberar", () => {
    const finance = session("finanzas", "laura");
    const cases = [
      [factura({ estado: "Revisar" }), "aprobar", 5],
      [factura(), "rechazar", 5],
      [factura({ estado: "Duplicada" }), "liberar", 10],
    ];
    for (const [invoice, accion, minimum] of cases) {
      expect(() =>
        applyDecision(invoice, { accion, session: finance, comentario: "  ", ahora }),
      ).toThrow(`El comentario es obligatorio (mínimo ${minimum} caracteres)`);
      expect(() =>
        applyDecision(invoice, {
          accion,
          session: finance,
          comentario: "x".repeat(minimum - 1),
          ahora,
        }),
      ).toThrow(`El comentario es obligatorio (mínimo ${minimum} caracteres)`);
    }
  });

  it("rechaza y libera con los motivos, estado, fechas y comentarios esperados", () => {
    const finance = session("finanzas", "laura");
    const rejected = applyDecision(factura(), {
      accion: "rechazar",
      session: finance,
      comentario: "Datos incorrectos",
      ahora,
    });
    expect(rejected).toMatchObject({
      estado: "Rechazada",
      decididaPor: "laura",
      decididaEn: ahora,
      historial: [
        {
          fecha: ahora,
          accion: "rechazar",
          usuario: "laura",
          rol: "finanzas",
          nombre: "Persona laura",
          comentario: "Datos incorrectos",
        },
      ],
    });

    const duplicate = factura({
      estado: "Duplicada",
      duplicadoDe: { id: "FAC-ORIGINAL", tipo: "hash" },
      motivos: ["Coincide con una factura existente"],
    });
    const released = applyDecision(duplicate, {
      accion: "liberar",
      session: finance,
      comentario: "El archivo corresponde a otra factura",
      ahora,
    });
    expect(released).toMatchObject({
      estado: "Revisar",
      duplicadoDe: { id: "FAC-ORIGINAL", tipo: "hash" },
      motivos: [
        "Coincide con una factura existente",
        "Liberada como no duplicada por Persona laura: El archivo corresponde a otra factura",
      ],
      historial: [
        {
          fecha: ahora,
          accion: "liberar",
          usuario: "laura",
          rol: "finanzas",
          nombre: "Persona laura",
          comentario: "El archivo corresponde a otra factura",
        },
      ],
    });
    expect(duplicate.estado).toBe("Duplicada");
    expect(duplicate.motivos).toHaveLength(1);
  });

  it("lanza el motivo exacto cuando la decisión está denegada", () => {
    expect(() =>
      applyDecision(factura(), {
        accion: "aprobar",
        session: session("ventas"),
        ahora,
      }),
    ).toThrow("No tienes permiso para decidir sobre facturas");
  });

  it("usa las definiciones reales de permisos de los roles", () => {
    for (const role of roles) {
      expect(can(role.codigo, "facturas_proveedores", "aprobar")).toBe(
        role.permisos.facturas_proveedores.includes("aprobar"),
      );
    }
    expect(rolesPorCodigo.get("direccion").permisos.facturas_proveedores).toContain("aprobar");
    expect(rolesPorCodigo.get("finanzas").permisos.facturas_proveedores).toContain("aprobar");
  });
});
