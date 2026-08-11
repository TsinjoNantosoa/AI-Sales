import type { AuthUser } from "@/types";
import { USE_MOCKS, DEMO_PASSWORDS } from "@/lib/constants";
import { apiClient } from "@/lib/apiClient";
import { getDatabase } from "@/mocks/mockRepository";

const DEMO_USER_IDS: Record<string, string> = {
  "admin@aisales.demo": "u1",
  "manager@aisales.demo": "u2",
  "sales@aisales.demo": "u3",
};

/** Session-only demo password overrides (never persisted). */
const sessionPasswordOverrides: Record<string, string> = {};

export const authService = {
  async login(
    email: string,
    password: string
  ): Promise<{ user: AuthUser; token: string; refreshToken?: string }> {
    if (USE_MOCKS) {
      await new Promise((r) => setTimeout(r, 400));
      const expected =
        sessionPasswordOverrides[email] ?? DEMO_PASSWORDS[email];
      const userId = DEMO_USER_IDS[email];
      if (!expected || !userId || expected !== password) {
        throw new Error("Invalid credentials");
      }
      const user = getDatabase().users.find((u) => u.id === userId);
      if (!user || user.status !== "active") throw new Error("Invalid credentials");
      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          timezone: user.timezone,
          language: user.language,
          avatar: user.avatar,
        },
        token: `mock-jwt-${user.id}`,
        refreshToken: `mock-refresh-${user.id}`,
      };
    }
    return apiClient.post("/auth/login", { email, password });
  },

  async logout(refreshToken?: string | null): Promise<void> {
    if (USE_MOCKS) return;
    await apiClient.post("/auth/logout", { refreshToken });
  },

  async refresh(refreshToken: string): Promise<{ user: AuthUser; token: string; refreshToken?: string }> {
    if (USE_MOCKS) {
      throw new Error("Refresh not available in mock mode");
    }
    return apiClient.post("/auth/refresh", { refreshToken }, { skipAuth: true });
  },

  async forgotPassword(email: string): Promise<{ resetToken?: string }> {
    if (USE_MOCKS) {
      await new Promise((r) => setTimeout(r, 400));
      if (!DEMO_PASSWORDS[email] && !DEMO_USER_IDS[email]) {
        return {};
      }
      return { resetToken: `mock-reset-${btoa(email)}` };
    }
    return apiClient.post("/auth/forgot-password", { email });
  },

  async resetPassword(token: string, password: string): Promise<void> {
    if (USE_MOCKS) {
      await new Promise((r) => setTimeout(r, 400));
      if (!token.startsWith("mock-reset-")) {
        throw new Error("Invalid or expired reset token");
      }
      try {
        const email = atob(token.replace("mock-reset-", ""));
        if (!DEMO_USER_IDS[email]) throw new Error("Invalid token");
        sessionPasswordOverrides[email] = password;
      } catch {
        throw new Error("Invalid or expired reset token");
      }
      return;
    }
    await apiClient.post("/auth/reset-password", { token, password });
  },

  async getMe(): Promise<AuthUser> {
    if (USE_MOCKS) {
      await new Promise((r) => setTimeout(r, 200));
      const user = getDatabase().users[0];
      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        timezone: user.timezone,
        language: user.language,
      };
    }
    return apiClient.get("/auth/me");
  },
};
