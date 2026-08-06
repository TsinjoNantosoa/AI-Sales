import type { Settings } from "@/types";
import { USE_MOCKS } from "@/lib/constants";
import { apiClient } from "@/lib/apiClient";
import { getDatabase, updateSettings } from "@/mocks/mockRepository";

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

export const settingsService = {
  async getSettings(): Promise<Settings> {
    if (USE_MOCKS) {
      await delay();
      return { ...getDatabase().settings };
    }
    return apiClient.get("/settings");
  },

  async updateSettings(data: Partial<Settings>): Promise<Settings> {
    if (USE_MOCKS) {
      await delay(400);
      return updateSettings(data);
    }
    return apiClient.patch("/settings", data);
  },
};
