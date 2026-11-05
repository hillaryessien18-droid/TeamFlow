import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { setAuthFailureHandler, tokenStore } from "../api/client";
import { authApi } from "../api/endpoints";
import type { User } from "../api/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; full_name: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => tokenStore.hasTokens());

  useEffect(() => {
    setAuthFailureHandler(() => setUser(null));
    if (!tokenStore.hasTokens()) return;
    authApi
      .me()
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    tokenStore.set(data);
    setUser(data.user);
  }, []);

  const register = useCallback(async (input: { email: string; full_name: string; password: string }) => {
    const data = await authApi.register(input);
    tokenStore.set(data);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    const refresh = tokenStore.refresh;
    try {
      if (refresh) await authApi.logout(refresh);
    } catch {
      // The token may already be expired or blacklisted; logging out locally is enough.
    } finally {
      tokenStore.clear();
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, setUser }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
