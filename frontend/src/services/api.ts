const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== "false";

export { API_URL, USE_MOCKS };

export async function apiRequest<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
