import { mockAppointments } from "@/mocks/data";
import type { Appointment } from "@/types";
import { USE_MOCKS, apiRequest } from "./api";

let appointments = [...mockAppointments];
const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms));

export const appointmentService = {
  async getAppointments(): Promise<Appointment[]> {
    if (USE_MOCKS) { await delay(); return [...appointments]; }
    return apiRequest("/appointments");
  },

  async getAppointment(id: string): Promise<Appointment> {
    if (USE_MOCKS) {
      await delay(200);
      const a = appointments.find((a) => a.id === id);
      if (!a) throw new Error("Not found");
      return a;
    }
    return apiRequest(`/appointments/${id}`);
  },

  async createAppointment(data: Omit<Appointment, "id" | "createdAt">): Promise<Appointment> {
    if (USE_MOCKS) {
      await delay();
      const appt: Appointment = {
        ...data,
        id: `a${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      appointments = [appt, ...appointments];
      return appt;
    }
    return apiRequest("/appointments", { method: "POST", body: JSON.stringify(data) });
  },

  async updateAppointment(id: string, data: Partial<Appointment>): Promise<Appointment> {
    if (USE_MOCKS) {
      await delay();
      const idx = appointments.findIndex((a) => a.id === id);
      if (idx === -1) throw new Error("Not found");
      appointments[idx] = { ...appointments[idx], ...data };
      return appointments[idx];
    }
    return apiRequest(`/appointments/${id}`, { method: "PATCH", body: JSON.stringify(data) });
  },

  async deleteAppointment(id: string): Promise<void> {
    if (USE_MOCKS) {
      await delay();
      appointments = appointments.filter((a) => a.id !== id);
      return;
    }
    return apiRequest(`/appointments/${id}`, { method: "DELETE" });
  },

  async getAvailableSlots(date: string, userId: string): Promise<string[]> {
    if (USE_MOCKS) {
      await delay(300);
      void userId;
      const takenTimes = appointments
        .filter((a) => a.date === date && a.status !== "Cancelled")
        .map((a) => a.time);
      const allSlots = ["09:00","09:30","10:00","10:30","11:00","11:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00"];
      return allSlots.filter((s) => !takenTimes.includes(s));
    }
    return apiRequest(`/calendar/slots?date=${date}&userId=${userId}`);
  },
};
