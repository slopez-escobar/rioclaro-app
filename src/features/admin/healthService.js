import { apiClient } from "../../shared/api/apiClient.js";

const SERVICE_KEYS = ["documentIntelligence", "chat", "language", "speech"];

export function createHealthService({ client = apiClient } = {}) {
  return {
    async getHealth() {
      try {
        const response = await client.request("/health");
        if (!response?.servicios || !SERVICE_KEYS.every((key) => typeof response.servicios[key] === "boolean")) {
          return { disponible: false };
        }
        return {
          disponible: true,
          servicios: Object.fromEntries(SERVICE_KEYS.map((key) => [key, response.servicios[key]])),
          asistenteEncendido: Boolean(response.asistenteEncendido),
        };
      } catch {
        return { disponible: false };
      }
    },
  };
}

export const healthService = createHealthService();
export const getHealth = () => healthService.getHealth();