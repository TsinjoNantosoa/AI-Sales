import type { Task } from "@/types";
import { USE_MOCKS } from "@/lib/constants";
import { apiClient } from "@/lib/apiClient";
import {
  getDatabase,
  createTask as repoCreate,
  updateTask as repoUpdate,
  completeTask as repoComplete,
} from "@/mocks/mockRepository";

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

export const taskService = {
  async getTasks(opts?: { currentUserId?: string; role?: string }): Promise<Task[]> {
    if (USE_MOCKS) {
      await delay();
      let list = [...getDatabase().tasks];
      if (opts?.role === "SALES_REPRESENTATIVE" && opts.currentUserId) {
        list = list.filter((t) => t.assignedUserId === opts.currentUserId);
      }
      return list;
    }
    return apiClient.get("/tasks");
  },

  async createTask(data: Omit<Task, "id" | "createdAt">): Promise<Task> {
    if (USE_MOCKS) {
      await delay();
      return repoCreate(data);
    }
    return apiClient.post("/tasks", data);
  },

  async updateTask(id: string, data: Partial<Task>): Promise<Task> {
    if (USE_MOCKS) {
      await delay();
      return repoUpdate(id, data);
    }
    return apiClient.patch(`/tasks/${id}`, data);
  },

  async deleteTask(id: string): Promise<void> {
    if (USE_MOCKS) {
      await delay();
      const db = getDatabase();
      db.tasks = db.tasks.filter((t) => t.id !== id);
      return;
    }
    await apiClient.delete(`/tasks/${id}`);
  },

  async completeTask(id: string): Promise<Task> {
    if (USE_MOCKS) {
      await delay();
      return repoComplete(id);
    }
    return apiClient.post(`/tasks/${id}/complete`);
  },
};
