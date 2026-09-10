const API_ENDPOINT_KEY = "neurospeech_api_url";

export function normalizeApiBase(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      return null;
    }
    const pathname = url.pathname.replace(/\/+$/, '');
    if (pathname && pathname !== '/api/v1') return null;
    if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return null;
    return `${url.origin}${pathname === '/api/v1' ? '' : ''}`;
  } catch {
    return null;
  }
}

function normalizeSharedApiBase(value: string): string | null {
  const normalized = normalizeApiBase(value);
  if (!normalized) return null;
  try {
    const url = new URL(normalized);
    return url.protocol === 'https:' && url.hostname.endsWith('.trycloudflare.com') ? normalized : null;
  } catch {
    return null;
  }
}

export function getActiveApiBase(): string {
  if (typeof window !== "undefined") {
    try {
      const params = new URLSearchParams(window.location.search);
      const paramUrl = params.get("apiUrl");
      const sharedBase = paramUrl ? normalizeSharedApiBase(paramUrl) : null;
      if (sharedBase) {
        window.localStorage.setItem(API_ENDPOINT_KEY, sharedBase);
        return sharedBase;
      }
      const stored = window.localStorage.getItem(API_ENDPOINT_KEY);
      const storedBase = stored ? normalizeApiBase(stored) : null;
      if (storedBase) {
        return storedBase;
      }
    } catch {
      /* ignore storage access error */
    }
  }

  const envUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (envUrl) {
    return normalizeApiBase(envUrl) ?? "";
  }
  return "";
}

export const API_BASE = getActiveApiBase();
export const AUTH_EXPIRED_EVENT = "neurospeech-auth-expired";
export const API_ENDPOINT_STORAGE_KEY = API_ENDPOINT_KEY;

export function clearTokens() {
  window.localStorage.removeItem("access_token");
  window.localStorage.removeItem("refresh_token");
}

export function getWebSocketUrl(sessionId: string): string {
  const token = window.localStorage.getItem("access_token");
  if (!token) throw new Error("Please sign in before starting live analysis.");

  const configuredWs = (import.meta.env.VITE_WS_URL as string | undefined)?.replace(/\/$/, "");
  if (configuredWs) {
    const base = configuredWs.replace(/\/api\/v1$/, "");
    return `${base}/ws/sessions/${encodeURIComponent(sessionId)}?token=${encodeURIComponent(token)}`;
  }

  const activeBase = getActiveApiBase();
  if (activeBase) {
    const wsBase = activeBase.replace(/^http/, "ws");
    return `${wsBase}/ws/sessions/${encodeURIComponent(sessionId)}?token=${encodeURIComponent(token)}`;
  }

  const isBrowser = typeof window !== "undefined";
  const isHttps = isBrowser && window.location.protocol === "https:";
  const proto = isHttps ? "wss:" : "ws:";
  const isLocalhost = isBrowser && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  const host = isLocalhost ? "localhost:8000" : (isBrowser ? window.location.host : "localhost:8000");

  return `${proto}//${host}/ws/sessions/${encodeURIComponent(sessionId)}?token=${encodeURIComponent(token)}`;
}

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE" | "PUT";

async function request<T>(path: string, options: { method?: HttpMethod; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const { method = "GET", body, auth = true } = options;
  const token = window.localStorage.getItem("access_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "bypass-tunnel-reminder": "true",
  };
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  const base = getActiveApiBase();
  const response = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (response.status === 401 && auth) {
    // The finalized API has no refresh endpoint. Expiry requires a new login.
    clearTokens();
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    throw new ApiError("Your sign-in has expired. Please sign in again.", 401);
  }
  if (!response.ok) {
    const data: { detail?: unknown } = await response.json().catch(() => ({}));
    const detail = typeof data.detail === "string" ? data.detail
      : Array.isArray(data.detail) ? data.detail.map((item: { msg?: string }) => item.msg || "Invalid value").join("; ")
      : `Request failed: ${response.status}`;
    throw new ApiError(detail, response.status);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown, auth = true) => request<T>(path, { method: "POST", body, auth }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/** Fetch every page so history and attempt numbering never silently truncate. */
export async function listAll<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  for (let skip = 0; ; skip += 100) {
    const page = await api.get<T[]>(`${path}${path.includes("?") ? "&" : "?"}skip=${skip}&limit=100`);
    items.push(...page);
    if (page.length < 100) return items;
  }
}
