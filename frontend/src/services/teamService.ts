import type { User } from "@/types";
import { USE_MOCKS } from "@/lib/constants";
import { apiClient } from "@/lib/apiClient";
import {
  getDatabase,
  createUser,
  updateUser,
  deleteUser,
} from "@/mocks/mockRepository";

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

export const teamService = {
  async getUsers(): Promise<User[]> {
    if (USE_MOCKS) {
      await delay();
      return [...getDatabase().users];
    }
    return apiClient.get("/users");
  },

  async getUser(id: string): Promise<User> {
    if (USE_MOCKS) {
      await delay(150);
      const u = getDatabase().users.find((x) => x.id === id);
      if (!u) throw new Error("User not found");
      return u;
    }
    return apiClient.get(`/users/${id}`);
  },

  async inviteUser(data: {
    email: string;
    firstName: string;
    lastName: string;
    role: User["role"];
  }): Promise<User> {
    if (USE_MOCKS) {
      await delay(400);
      return createUser({
        ...data,
        status: "active",
        language: "en",
        timezone: "America/New_York",
        calendarConnected: false,
      });
    }
    return apiClient.post("/users/invite", data);
  },

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    if (USE_MOCKS) {
      await delay();
      return updateUser(id, data);
    }
    return apiClient.patch(`/users/${id}`, data);
  },

  async setStatus(id: string, status: "active" | "inactive"): Promise<User> {
    return this.updateUser(id, { status });
  },

  async deleteUser(id: string): Promise<void> {
    if (USE_MOCKS) {
      await delay();
      deleteUser(id);
      return;
    }
    await apiClient.delete(`/users/${id}`);
  },

  async getUserStats(id: string) {
    if (USE_MOCKS) {
      await delay(200);
      const db = getDatabase();
      const assigned = db.leads.filter((l) => l.assignedUserId === id);
      const meetings = db.appointments.filter((a) => a.assignedUserId === id);
      const wins = assigned.filter((l) => l.status === "WON");
      return {
        assignedLeads: assigned.length,
        activeOpportunities: assigned.filter((l) =>
          !["WON", "LOST", "INACTIVE"].includes(l.status)
        ).length,
        meetings: meetings.length,
        wins: wins.length,
        conversionRate: assigned.length
          ? Math.round((wins.length / assigned.length) * 1000) / 10
          : 0,
        revenue: wins.reduce((s, l) => s + (l.estimatedValue ?? 0), 0),
      };
    }
    return apiClient.get(`/users/${id}/stats`);
  },
};
