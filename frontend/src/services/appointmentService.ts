import type { Appointment } from "@/types";
import { USE_MOCKS } from "@/lib/constants";
import { apiClient } from "@/lib/apiClient";
import {
  getDatabase,
  createAppointment as repoCreate,
  updateAppointment as repoUpdate,
  cancelAppointment as repoCancel,
} from "@/mocks/mockRepository";

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

export const appointmentService = {
  async getAppointments(opts?: { currentUserId?: string; role?: string }): Promise<Appointment[]> {
    if (USE_MOCKS) {
      await delay();
      let list = [...getDatabase().appointments];
      if (opts?.role === "SALES_REPRESENTATIVE" && opts.currentUserId) {
        list = list.filter((a) => a.assignedUserId === opts.currentUserId);
      }
      return list;
    }
    return apiClient.get("/appointments");
  },

  async getAppointment(id: string): Promise<Appointment> {
    if (USE_MOCKS) {
      await delay(150);
      const a = getDatabase().appointments.find((x) => x.id === id);
      if (!a) throw new Error("Not found");
      return a;
    }
    return apiClient.get(`/appointments/${id}`);
  },

  async createAppointment(
    data: Omit<Appointment, "id" | "createdAt">
  ): Promise<Appointment> {
    if (USE_MOCKS) {
      await delay();
      return repoCreate(data);
    }
    return apiClient.post("/appointments", data);
  },

  async updateAppointment(id: string, data: Partial<Appointment>): Promise<Appointment> {
    if (USE_MOCKS) {
      await delay();
      return repoUpdate(id, data);
    }
    return apiClient.patch(`/appointments/${id}`, data);
  },

  async cancelAppointment(id: string): Promise<Appointment> {
    if (USE_MOCKS) {
      await delay();
      return repoCancel(id);
    }
    return apiClient.patch(`/appointments/${id}`, { status: "Cancelled" });
  },

  async deleteAppointment(id: string): Promise<void> {
    if (USE_MOCKS) {
      await delay();
      repoCancel(id);
      return;
    }
    await apiClient.delete(`/appointments/${id}`);
  },

  async getAvailableSlots(date: string, userId: string): Promise<string[]> {
    if (USE_MOCKS) {
      await delay(200);
      const taken = getDatabase()
        .appointments.filter((a) => a.date === date && a.status !== "Cancelled" && a.assignedUserId === userId)
        .map((a) => a.time);
      const allSlots = [
        "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
        "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00",
      ];
      return allSlots.filter((s) => !taken.includes(s));
    }
    return apiClient.get("/calendar/slots", { params: { date, userId } });
  },
};
