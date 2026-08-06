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
}

function getAccessToken(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.auth);
    if (!raw) {
      const legacy = localStorage.getItem("auth-storage");
      if (!legacy) return null;
      const parsed = JSON.parse(legacy) as { state?: { token?: string } };
      return parsed.state?.token ?? null;
    }
    const parsed = JSON.parse(raw) as { state?: { token?: string }; token?: string };
    return parsed.state?.token ?? parsed.token ?? null;
  } catch {
    return null;
  }
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

    if (res.status === 401) {
      // Placeholder for refresh-token flow against FastAPI
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
