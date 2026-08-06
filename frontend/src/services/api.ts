export { API_URL, USE_MOCKS } from "@/lib/constants";
export { apiClient, ApiError } from "@/lib/apiClient";

/** @deprecated Prefer apiClient — kept for gradual migration */
export async function apiRequest<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const { apiClient } = await import("@/lib/apiClient");
  const method = (options?.method ?? "GET").toUpperCase();
  const body = options?.body ? JSON.parse(options.body as string) : undefined;
  if (method === "POST") return apiClient.post<T>(path, body);
  if (method === "PATCH") return apiClient.patch<T>(path, body);
  if (method === "PUT") return apiClient.put<T>(path, body);
  if (method === "DELETE") return apiClient.delete<T>(path);
  return apiClient.get<T>(path);
}
