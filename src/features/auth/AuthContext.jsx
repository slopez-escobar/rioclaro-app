import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as svc from "./authService.js";
import { STORAGE_KEYS, STORAGE_PREFIX } from "../../config/constants.js";
import { DEMO_RESET_EVENT } from "../demo/demoService.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => svc.getSession());
  const refreshSession = useCallback(() => {
    const current = svc.getSession();
    setSession(current);
    return current;
  }, []);
  useEffect(() => {
    const refresh = (event) => {
      if (
        event
        && event.key
        && event.key !== `${STORAGE_PREFIX}${STORAGE_KEYS.session}`
        && event.key !== `${STORAGE_PREFIX}${STORAGE_KEYS.authToken}`
        && event.key !== `${STORAGE_PREFIX}${STORAGE_KEYS.disabledAccounts}`
      ) return;
      refreshSession();
    };
    const reset = () => setSession(null);
    globalThis.addEventListener?.("storage", refresh);
    globalThis.addEventListener?.(DEMO_RESET_EVENT, reset);
    return () => {
      globalThis.removeEventListener?.("storage", refresh);
      globalThis.removeEventListener?.(DEMO_RESET_EVENT, reset);
    };
  }, [refreshSession]);
  const value = useMemo(
    () => ({
      session,
      refreshSession,
      async login(usuario, password) {
        let r;
        if (import.meta.env.VITE_USE_AZURE === "true") {
          r = await svc.loginRemote(usuario, password);
        } else {
          const localAuth = await import("./authService.local.js");
          r = localAuth.login(usuario, password);
        }
        if (r.ok) setSession(r.session);
        return r;
      },
      logout() { svc.logout(); setSession(null); },
    }),
    [session, refreshSession]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
