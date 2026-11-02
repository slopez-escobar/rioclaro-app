function value(env, name) {
  const result = env[name];
  return typeof result === "string" ? result.trim() : "";
}

function service(env, fields, variables, defaults = {}) {
  const result = Object.fromEntries(
    fields.map((field) => [field, value(env, variables[field]) || defaults[field] || ""]),
  );
  if (result.endpoint) result.endpoint = result.endpoint.replace(/\/+$/, "");
  result.configurado = fields.every((field) => Boolean(result[field]));
  return result;
}

export function loadConfig(env = process.env) {
  const tokenSecret = value(env, "TOKEN_SECRET");
  if (tokenSecret.length < 32) {
    throw new Error("Configuración inválida: TOKEN_SECRET");
  }

  const ttlValue = value(env, "TOKEN_TTL_HOURS") || "8";
  const tokenTtlHours = Number(ttlValue);
  if (!Number.isFinite(tokenTtlHours) || tokenTtlHours <= 0) {
    throw new Error("Configuración inválida: TOKEN_TTL_HOURS");
  }

  const assistantValue = value(env, "ASSISTANT_ENABLED") || "true";
  if (!["true", "false"].includes(assistantValue)) {
    throw new Error("Configuración inválida: ASSISTANT_ENABLED");
  }

  return {
    tokenSecret,
    tokenTtlHours,
    assistantEnabled: assistantValue === "true",
    receptorRfc: value(env, "RECEPTOR_RFC") || "DRC0401127K2",
    docIntelligence: service(env, ["endpoint", "key", "apiVersion"], {
      endpoint: "DOCINT_ENDPOINT",
      key: "DOCINT_KEY",
      apiVersion: "DOCINT_API_VERSION",
    }, { apiVersion: "2024-11-30" }),
    chat: service(env, ["endpoint", "key", "deployment", "apiVersion"], {
      endpoint: "AOAI_ENDPOINT",
      key: "AOAI_KEY",
      deployment: "AOAI_DEPLOYMENT",
      apiVersion: "AOAI_API_VERSION",
    }, { apiVersion: "2024-10-21" }),
    language: service(env, ["endpoint", "key", "apiVersion"], {
      endpoint: "LANGUAGE_ENDPOINT",
      key: "LANGUAGE_KEY",
      apiVersion: "LANGUAGE_API_VERSION",
    }, { apiVersion: "2023-04-01" }),
    speech: service(env, ["region", "key"], {
      region: "SPEECH_REGION",
      key: "SPEECH_KEY",
    }),
  };
}
