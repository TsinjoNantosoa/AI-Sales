import type { AuditLog } from "@/types";
import { USE_MOCKS } from "@/lib/constants";
import { apiClient } from "@/lib/apiClient";
import { getDatabase, appendAuditLog } from "@/mocks/mockRepository";

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

export const auditService = {
  async getLogs(): Promise<AuditLog[]> {
    if (USE_MOCKS) {
      await delay();
      return [...getDatabase().auditLogs];
    }
    return apiClient.get("/audit-logs");
  },

  async create(data: Omit<AuditLog, "id" | "timestamp">): Promise<AuditLog> {
    if (USE_MOCKS) {
      return appendAuditLog(data);
    }
    return apiClient.post("/audit-logs", data);
  },
};
