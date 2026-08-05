import { mockTasks } from "@/mocks/data";
import type { Task } from "@/types";
import { USE_MOCKS, apiRequest } from "./api";

let tasks = [...mockTasks];
const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms));

export const taskService = {
  async getTasks(): Promise<Task[]> {
    if (USE_MOCKS) { await delay(); return [...tasks]; }
    return apiRequest("/tasks");
  },

  async createTask(data: Omit<Task, "id" | "createdAt">): Promise<Task> {
    if (USE_MOCKS) {
      await delay();
      const task: Task = { ...data, id: `t${Date.now()}`, createdAt: new Date().toISOString() };
      tasks = [task, ...tasks];
      return task;
    }
    return apiRequest("/tasks", { method: "POST", body: JSON.stringify(data) });
  },

  async updateTask(id: string, data: Partial<Task>): Promise<Task> {
    if (USE_MOCKS) {
      await delay();
      const idx = tasks.findIndex((t) => t.id === id);
      if (idx === -1) throw new Error("Not found");
      tasks[idx] = { ...tasks[idx], ...data };
      return tasks[idx];
    }
    return apiRequest(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) });
  },

  async deleteTask(id: string): Promise<void> {
    if (USE_MOCKS) {
      await delay();
      tasks = tasks.filter((t) => t.id !== id);
    } else {
      return apiRequest(`/tasks/${id}`, { method: "DELETE" });
    }
  },

  async completeTask(id: string): Promise<Task> {
    return this.updateTask(id, { status: "Completed", completedAt: new Date().toISOString() });
  },
};
