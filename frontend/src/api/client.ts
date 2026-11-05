import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

const BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");
export const API_URL = `${BASE}/api`;

const ACCESS_KEY = "teamflow.access";
const REFRESH_KEY = "teamflow.refresh";

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  hasTokens() {
    return Boolean(this.access || this.refresh);
  },
  set({ access, refresh }: { access: string; refresh: string }) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = tokenStore.access;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onAuthFailure: () => void = () => {};
export function setAuthFailureHandler(handler: () => void) {
  onAuthFailure = handler;
}

// One refresh at a time: refresh tokens rotate and are blacklisted after use,
// so parallel 401s must share a single refresh request.
let refreshing: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refresh = tokenStore.refresh;
  if (!refresh) throw new Error("No refresh token");
  const { data } = await axios.post<{ access: string; refresh?: string }>(`${API_URL}/auth/refresh/`, { refresh });
  tokenStore.set({ access: data.access, refresh: data.refresh ?? refresh });
  return data.access;
}

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const url = original?.url ?? "";
    const isAuthCall = url.startsWith("/auth/login") || url.startsWith("/auth/refresh");
    if (error.response?.status === 401 && original && !original._retry && !isAuthCall && tokenStore.refresh) {
      original._retry = true;
      try {
        refreshing ??= refreshAccessToken().finally(() => {
          refreshing = null;
        });
        const access = await refreshing;
        original.headers.Authorization = `Bearer ${access}`;
        return api(original);
      } catch {
        tokenStore.clear();
        onAuthFailure();
      }
    }
    return Promise.reject(error);
  },
);

function humanize(field: string) {
  const text = field.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function flatten(value: unknown): string {
  if (Array.isArray(value)) return value.map(flatten).join(" ");
  if (value && typeof value === "object") return Object.values(value).map(flatten).join(" ");
  return String(value);
}

/** Turn a DRF error response (or a network failure) into one readable sentence. */
export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!axios.isAxiosError(error)) return error instanceof Error && error.message ? error.message : fallback;
  if (!error.response) return "Can't reach the server. Check your connection and try again.";
  const data = error.response.data;
  if (typeof data === "string") return data.length < 200 && !data.trim().startsWith("<") ? data : fallback;
  if (data && typeof data === "object") {
    const parts = Object.entries(data as Record<string, unknown>).map(([field, value]) =>
      field === "detail" || field === "non_field_errors" ? flatten(value) : `${humanize(field)}: ${flatten(value)}`,
    );
    if (parts.length) return parts.join(" ");
  }
  return fallback;
}
