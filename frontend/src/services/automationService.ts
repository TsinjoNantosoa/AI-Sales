import type { Workflow, WorkflowExecution } from "@/types";
import { USE_MOCKS } from "@/lib/constants";
import { apiClient } from "@/lib/apiClient";
import {
  getDatabase,
  persistDatabase,
} from "@/mocks/mockRepository";

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

export const automationService = {
  async getWorkflows(): Promise<Workflow[]> {
    if (USE_MOCKS) {
      await delay();
      return [...getDatabase().workflows];
    }
    return apiClient.get("/automations/workflows");
  },

  async getExecutions(leadId?: string): Promise<WorkflowExecution[]> {
    if (USE_MOCKS) {
      await delay();
      const list = getDatabase().workflowExecutions;
      return leadId ? list.filter((e) => e.relatedLeadId === leadId) : [...list];
    }
    return apiClient.get("/automations/executions", { params: { leadId } });
  },

  async toggleWorkflow(id: string): Promise<Workflow> {
    if (USE_MOCKS) {
      await delay();
      const w = getDatabase().workflows.find((x) => x.id === id);
      if (!w) throw new Error("Not found");
      w.status = w.status === "active" ? "inactive" : "active";
      persistDatabase();
      return { ...w };
    }
    return apiClient.post(`/automations/workflows/${id}/toggle`);
  },

  async testWorkflow(id: string): Promise<WorkflowExecution> {
    if (USE_MOCKS) {
      await delay(600);
      const db = getDatabase();
      const w = db.workflows.find((x) => x.id === id);
      if (!w) throw new Error("Not found");
      const exec: WorkflowExecution = {
        id: `exec${Date.now()}`,
        workflowId: id,
        workflowName: w.name,
        status: "Success",
        startedAt: new Date().toISOString(),
        duration: "1.8s",
        retryCount: 0,
      };
      db.workflowExecutions = [exec, ...db.workflowExecutions];
      w.totalExecutions += 1;
      w.lastExecution = exec.startedAt;
      persistDatabase();
      return exec;
    }
    return apiClient.post(`/automations/workflows/${id}/test`);
  },
};
