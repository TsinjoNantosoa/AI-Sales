import { API_URL, STORAGE_KEYS } from "./constants";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

type QueryParams = Record<string, string | number | boolean | undefined | null>;

interface RequestOptions {
  headers?: Record<string, string>;
  params?: QueryParams;
  signal?: AbortSignal;
  timeoutMs?: number;
  skipAuth?: boolean;
  /** Internal: skip refresh retry to avoid loops */
  _retried?: boolean;
}

interface AuthPersistShape {
  state?: {
    token?: string | null;
    refreshToken?: string | null;
    user?: unknown;
    isAuthenticated?: boolean;
  };
  token?: string;
  refreshToken?: string;
}

function readAuthPersist(): AuthPersistShape | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.auth);
    if (!raw) {
      const legacy = localStorage.getItem("auth-storage");
      if (!legacy) return null;
      return JSON.parse(legacy) as AuthPersistShape;
    }
    return JSON.parse(raw) as AuthPersistShape;
  } catch {
    return null;
  }
}

function getAccessToken(): string | null {
  const parsed = readAuthPersist();
  if (!parsed) return null;
  return parsed.state?.token ?? parsed.token ?? null;
}

function getRefreshToken(): string | null {
  const parsed = readAuthPersist();
  if (!parsed) return null;
  return parsed.state?.refreshToken ?? parsed.refreshToken ?? null;
}

function patchAuthTokens(accessToken: string, refreshToken?: string | null): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.auth);
    if (!raw) return;
    const parsed = JSON.parse(raw) as AuthPersistShape;
    if (parsed.state) {
      parsed.state.token = accessToken;
      if (refreshToken) parsed.state.refreshToken = refreshToken;
      else if (refreshToken === null) parsed.state.refreshToken = undefined;
    } else {
      parsed.token = accessToken;
      if (refreshToken) parsed.refreshToken = refreshToken;
      else if (refreshToken === null) parsed.refreshToken = undefined;
    }
    localStorage.setItem(STORAGE_KEYS.auth, JSON.stringify(parsed));
  } catch {
    // ignore
  }
}

function clearAuthAndRedirect(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.auth);
    localStorage.removeItem("auth-storage");
  } catch {
    // ignore
  }
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as {
        token?: string;
        refreshToken?: string;
      };
      if (!body.token) return null;
      patchAuthTokens(body.token, body.refreshToken ?? refreshToken);
      return body.token;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function buildUrl(path: string, params?: QueryParams): string {
  const url = new URL(path.startsWith("http") ? path : `${API_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
}

async function parseError(res: Response): Promise<ApiError> {
  let details: unknown;
  let message = `API error: ${res.status}`;
  try {
    const body = await res.json();
    details = body;
    if (typeof body === "object" && body !== null) {
      const b = body as { detail?: unknown; message?: string };
      if (typeof b.message === "string") message = b.message;
      else if (typeof b.detail === "string") message = b.detail;
      else if (Array.isArray(b.detail)) {
        message = b.detail
          .map((d) => (typeof d === "object" && d && "msg" in d ? String((d as { msg: string }).msg) : String(d)))
          .join(", ");
      }
    }
  } catch {
    // no JSON body
  }
  return new ApiError(message, res.status, details);
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<T> {
  const controller = new AbortController();
  const timeout = options.timeoutMs ?? 30_000;
  const timer = setTimeout(() => controller.abort(), timeout);

  const externalSignal = options.signal;
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...options.headers,
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (!options.skipAuth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  try {
    const res = await fetch(buildUrl(path, options.params), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (res.status === 401 && !options.skipAuth && !options._retried && !path.includes("/auth/")) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        return request<T>(method, path, body, { ...options, _retried: true });
      }
      clearAuthAndRedirect();
      throw new ApiError("Unauthorized", 401);
    }

    if (res.status === 401) {
      throw new ApiError("Unauthorized", 401);
    }

    if (!res.ok) throw await parseError(res);

    if (res.status === 204 || res.headers.get("content-length") === "0") {
      return undefined as T;
    }

    const text = await res.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError("Request timeout", 408);
    }
    throw new ApiError(err instanceof Error ? err.message : "Network error", 0);
  } finally {
    clearTimeout(timer);
  }
}

export const apiClient = {
  get<T>(path: string, options?: RequestOptions) {
    return request<T>("GET", path, undefined, options);
  },
  post<TResponse, TBody = unknown>(path: string, body?: TBody, options?: RequestOptions) {
    return request<TResponse>("POST", path, body, options);
  },
  patch<TResponse, TBody = unknown>(path: string, body?: TBody, options?: RequestOptions) {
    return request<TResponse>("PATCH", path, body, options);
  },
  put<TResponse, TBody = unknown>(path: string, body?: TBody, options?: RequestOptions) {
    return request<TResponse>("PUT", path, body, options);
  },
  delete<T>(path: string, options?: RequestOptions) {
    return request<T>("DELETE", path, undefined, options);
  },
};
