export function createHealthHandler({ config, now = Date.now } = {}) {
  return async function healthHandler() {
    const currentTime = typeof now === "function" ? now() : now;
    return {
      status: 200,
      jsonBody: {
        ok: true,
        version: "1.0.0",
        servicios: {
          documentIntelligence: config.docIntelligence.configurado,
          chat: config.chat.configurado,
          language: config.language.configurado,
          speech: config.speech.configurado,
        },
        asistenteEncendido: config.assistantEnabled,
        hora: new Date(currentTime).toISOString(),
      },
    };
  };
}
