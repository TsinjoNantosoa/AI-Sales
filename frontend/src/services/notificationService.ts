import { mockNotifications } from "@/mocks/data";
import type { Notification } from "@/types";
import { USE_MOCKS, apiRequest } from "./api";

let notifications = [...mockNotifications];
const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

export const notificationService = {
  async getNotifications(): Promise<Notification[]> {
    if (USE_MOCKS) { await delay(); return [...notifications]; }
    return apiRequest("/notifications");
  },

  async markRead(id: string): Promise<void> {
    if (USE_MOCKS) {
      await delay(100);
      const idx = notifications.findIndex((n) => n.id === id);
      if (idx !== -1) notifications[idx] = { ...notifications[idx], read: true };
      return;
    }
    return apiRequest(`/notifications/${id}/read`, { method: "POST" });
  },

  async markAllRead(): Promise<void> {
    if (USE_MOCKS) {
      await delay(200);
      notifications = notifications.map((n) => ({ ...n, read: true }));
      return;
    }
    return apiRequest("/notifications/read-all", { method: "POST" });
  },

  async deleteNotification(id: string): Promise<void> {
    if (USE_MOCKS) {
      await delay(200);
      notifications = notifications.filter((n) => n.id !== id);
      return;
    }
    return apiRequest(`/notifications/${id}`, { method: "DELETE" });
  },
};
