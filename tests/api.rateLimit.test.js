import { describe, expect, it } from "vitest";
import { createRateLimiter } from "../api/src/lib/rateLimit.js";

describe("límite deslizante de intentos", () => {
  it("respeta el máximo y libera solicitudes después de la ventana", () => {
    let time = 0;
    const limiter = createRateLimiter({ now: () => time });
    const options = { max: 2, ventanaMs: 1000 };
    expect(limiter.check("usuario:a", options).permitido).toBe(true);
    expect(limiter.check("usuario:a", options).permitido).toBe(true);
    expect(limiter.check("usuario:a", options)).toMatchObject({
      permitido: false,
      reintentarEnSegundos: 1,
    });
    time = 1001;
    expect(limiter.check("usuario:a", options).permitido).toBe(true);
  });

  it("mantiene las claves independientes", () => {
    const limiter = createRateLimiter({ now: () => 10 });
    const options = { max: 1, ventanaMs: 100 };
    limiter.check("ip:a", options);
    expect(limiter.check("ip:b", options).permitido).toBe(true);
  });

  it("peek consulta el límite sin consumir intentos", () => {
    const limiter = createRateLimiter({ now: () => 10 });
    const options = { max: 1, ventanaMs: 100 };
    expect(limiter.peek("usuario:a", options).permitido).toBe(true);
    expect(limiter.check("usuario:a", options).permitido).toBe(true);
    expect(limiter.peek("usuario:a", options).permitido).toBe(false);
  });
});
