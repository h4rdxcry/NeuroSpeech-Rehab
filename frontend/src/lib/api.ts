function resolveApiBase(): string {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (envUrl) {
    return envUrl.replace(/\/$/, "").replace(/\/api\/v1$/, "");
  }
  return "";
}

export const API_BASE = resolveApiBase();
export const AUTH_EXPIRED_EVENT = "neurospeech-auth-expired";

export function clearTokens() {
  window.localStorage.removeItem("access_token");
  window.localStorage.removeItem("refresh_token");
}

export function getWebSocketUrl(sessionId: string): string {
  const configured = (import.meta.env.VITE_WS_URL as string | undefined)?.replace(/\/$/, "");
  const proto = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = typeof window !== "undefined" ? window.location.host : "localhost:8000";
  const base = (configured || `${proto}//${host}`).replace(/\/api\/v1$/, "");
  const token = window.localStorage.getItem("access_token");
  if (!token) throw new Error("Please sign in before starting live analysis.");
  return `${base}/ws/sessions/${encodeURIComponent(sessionId)}?token=${encodeURIComponent(token)}`;
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
  const response = await fetch(`${API_BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
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
