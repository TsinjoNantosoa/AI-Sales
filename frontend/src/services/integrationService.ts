import type { Integration } from "@/types";
import { USE_MOCKS } from "@/lib/constants";
import { apiClient } from "@/lib/apiClient";
import { getDatabase, updateIntegration, appendAuditLog } from "@/mocks/mockRepository";

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

export const integrationService = {
  async getIntegrations(): Promise<Integration[]> {
    if (USE_MOCKS) {
      await delay();
      return [...getDatabase().integrations];
    }
    return apiClient.get("/integrations");
  },

  async connect(id: string): Promise<Integration> {
    if (USE_MOCKS) {
      await delay(800);
      const updated = updateIntegration(id, {
        status: "connected",
        lastSync: new Date().toISOString(),
      });
      appendAuditLog({
        userId: "system",
        userName: "System",
        action: "integration.connect",
        entity: "integration",
        entityId: id,
        ip: "127.0.0.1",
        result: "success",
        details: `Connected ${updated.name}`,
      });
      return updated;
    }
    return apiClient.post(`/integrations/${id}/connect`);
  },

  async disconnect(id: string): Promise<Integration> {
    if (USE_MOCKS) {
      await delay(400);
      return updateIntegration(id, { status: "available", lastSync: undefined });
    }
    return apiClient.post(`/integrations/${id}/disconnect`);
  },

  async testConnection(id: string): Promise<{ ok: boolean; message: string }> {
    if (USE_MOCKS) {
      await delay(600);
      const integ = getDatabase().integrations.find((i) => i.id === id);
      if (!integ) throw new Error("Not found");
      if (integ.status !== "connected") {
        return { ok: false, message: "Integration is not connected" };
      }
      return { ok: true, message: "Connection successful (mock)" };
    }
    return apiClient.post(`/integrations/${id}/test`);
  },

  async synchronize(id: string): Promise<Integration> {
    if (USE_MOCKS) {
      await delay(1000);
      return updateIntegration(id, { lastSync: new Date().toISOString() });
    }
    return apiClient.post(`/integrations/${id}/sync`);
  },

  async configure(id: string, _config: Record<string, string>): Promise<Integration> {
    if (USE_MOCKS) {
      await delay(400);
      // Secrets are never stored — only acknowledge configuration
      void _config;
      return updateIntegration(id, { lastSync: new Date().toISOString() });
    }
    return apiClient.patch(`/integrations/${id}`, { configured: true });
  },
};
