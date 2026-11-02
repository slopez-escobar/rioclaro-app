export function createRateLimiter({ now = Date.now } = {}) {
  // El límite es por instancia; en producción debe usarse un almacén compartido.
  const attempts = new Map();

  function evaluate(clave, { max, ventanaMs }, registrar) {
    const currentTime = now();
    for (const [key, timestamps] of attempts) {
      const fresh = timestamps.filter((timestamp) => currentTime - timestamp < ventanaMs);
      if (fresh.length) attempts.set(key, fresh);
      else attempts.delete(key);
    }

    const fresh = (attempts.get(clave) ?? [])
      .filter((timestamp) => currentTime - timestamp < ventanaMs);
    if (fresh.length >= max) {
      return {
        permitido: false,
        reintentarEnSegundos: Math.max(1, Math.ceil((fresh[0] + ventanaMs - currentTime) / 1000)),
      };
    }
    if (registrar) {
      fresh.push(currentTime);
      attempts.set(clave, fresh);
    }
    return { permitido: true, reintentarEnSegundos: 0 };
  }

  return {
    check(clave, options) {
      return evaluate(clave, options, true);
    },
    peek(clave, options) {
      return evaluate(clave, options, false);
    },
  };
}
