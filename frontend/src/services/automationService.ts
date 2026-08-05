import { mockWorkflows, mockWorkflowExecutions } from "@/mocks/data";
import type { Workflow, WorkflowExecution } from "@/types";
import { USE_MOCKS, apiRequest } from "./api";

let workflows = [...mockWorkflows];
const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms));

export const automationService = {
  async getWorkflows(): Promise<Workflow[]> {
    if (USE_MOCKS) { await delay(); return [...workflows]; }
    return apiRequest("/automations");
  },

  async getExecutions(): Promise<WorkflowExecution[]> {
    if (USE_MOCKS) { await delay(); return [...mockWorkflowExecutions]; }
    return apiRequest("/automations/executions");
  },

  async toggleWorkflow(id: string, enable: boolean): Promise<Workflow> {
    if (USE_MOCKS) {
      await delay(300);
      const idx = workflows.findIndex((w) => w.id === id);
      if (idx !== -1) workflows[idx] = { ...workflows[idx], status: enable ? "active" : "inactive" };
      return workflows[idx];
    }
    return apiRequest(`/automations/${id}/${enable ? "enable" : "disable"}`, { method: "POST" });
  },

  async testWorkflow(id: string): Promise<{ success: boolean; message: string }> {
    if (USE_MOCKS) {
      await delay(1500);
      void id;
      return { success: true, message: "Workflow test completed successfully in 1.3s" };
    }
    return apiRequest(`/automations/${id}/test`, { method: "POST" });
  },
};
