import type { Notification } from "@/types";
import { USE_MOCKS } from "@/lib/constants";
import { apiClient } from "@/lib/apiClient";
import { getDatabase, markNotificationRead, createNotification } from "@/mocks/mockRepository";

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

export const notificationService = {
  async getNotifications(): Promise<Notification[]> {
    if (USE_MOCKS) {
      await delay();
      return [...getDatabase().notifications];
    }
    return apiClient.get("/notifications");
  },

  async markRead(id: string): Promise<Notification> {
    if (USE_MOCKS) {
      await delay(100);
      return markNotificationRead(id);
    }
    return apiClient.post(`/notifications/${id}/read`);
  },

  async markAllRead(): Promise<void> {
    if (USE_MOCKS) {
      await delay(150);
      getDatabase().notifications.forEach((n) => {
        n.read = true;
      });
      return;
    }
    await apiClient.post("/notifications/read-all");
  },

  async deleteNotification(id: string): Promise<void> {
    if (USE_MOCKS) {
      await delay(100);
      const db = getDatabase();
      db.notifications = db.notifications.filter((n) => n.id !== id);
      return;
    }
    await apiClient.delete(`/notifications/${id}`);
  },

  async create(data: Omit<Notification, "id" | "createdAt" | "read">): Promise<Notification> {
    if (USE_MOCKS) {
      return createNotification(data);
    }
    return apiClient.post("/notifications", data);
  },
};
