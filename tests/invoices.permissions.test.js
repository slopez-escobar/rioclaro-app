import { describe, expect, it } from "vitest";
import { can } from "../src/features/auth/permissions.js";
import { roles } from "../src/features/auth/data/roles.json";
import { canDecide } from "../src/features/invoices/domain/invoiceDecisions.js";
import { createInvoiceService } from "../src/features/invoices/invoiceService.js";

const expectedPermissions = {
  direccion: { ver: true, crear: false, aprobar: true },
  finanzas: { ver: true, crear: true, aprobar: true },
  compras: { ver: true, crear: true, aprobar: false },
  rh: { ver: false, crear: false, aprobar: false },
  administrador_ti: { ver: false, crear: false, aprobar: false },
  gerente_sucursal: { ver: false, crear: false, aprobar: false },
  ventas: { ver: false, crear: false, aprobar: false },
  bodega: { ver: false, crear: false, aprobar: false },
  reparto: { ver: false, crear: false, aprobar: false },
  administrativo: { ver: false, crear: false, aprobar: false },
  cliente: { ver: false, crear: false, aprobar: false },
};

const invoice = {
  id: "FAC-TEST",
  estado: "OK",
  total: 100,
  motivos: [],
  aprobaciones: [],
  historial: [],
};

describe("permisos reales de la pantalla de facturas", () => {
  it("coincide con la matriz de los 11 roles del catálogo", () => {
    expect(roles).toHaveLength(11);
    expect(new Set(roles.map((role) => role.codigo))).toEqual(
      new Set(Object.keys(expectedPermissions)),
    );
    for (const role of roles) {
      const expected = expectedPermissions[role.codigo];
      expect({
        ver: can(role.codigo, "facturas_proveedores", "ver"),
        crear: can(role.codigo, "facturas_proveedores", "crear"),
        aprobar: can(role.codigo, "facturas_proveedores", "aprobar"),
      }).toEqual(expected);
    }
  });

  it("un rol sin ver facturas no puede decidir ni subirlas", async () => {
    const role = roles.find(
      (item) => !can(item.codigo, "facturas_proveedores", "ver"),
    );
    expect(role).toBeDefined();
    expect(can(role.codigo, "facturas_proveedores", "aprobar")).toBe(false);
    expect(canDecide({ rol: role.codigo, usuario: "sin-acceso" }, invoice, "rechazar")).toEqual({
      permitido: false,
      motivo: "No tienes permiso para decidir sobre facturas",
    });

    const service = createInvoiceService({
      extractor: { async extractInvoice() { throw new Error("No debe extraer"); } },
      repository: {
        list() { throw new Error("No debe leer facturas"); },
        nextId() { throw new Error("No debe generar identificador"); },
        getById() { return invoice; },
        update() { throw new Error("No debe actualizar facturas"); },
      },
      proveedores: async () => [],
      hashFile: async () => "hash",
    });
    await expect(
      service.processFile(
        new File(["factura"], "factura.pdf", { type: "application/pdf" }),
        { rol: role.codigo, usuario: "sin-acceso" },
      ),
    ).rejects.toThrow("No tienes permiso para subir facturas");
  });
});
