import { mockUsers } from "@/mocks/data";
import type { AuthUser } from "@/types";
import { USE_MOCKS, apiRequest } from "./api";

const DEMO_CREDENTIALS: Record<string, { password: string; userId: string }> = {
  "admin@aisales.demo": { password: "Demo123!", userId: "u1" },
  "manager@aisales.demo": { password: "Demo123!", userId: "u2" },
  "sales@aisales.demo": { password: "Demo123!", userId: "u3" },
};

export const authService = {
  async login(email: string, password: string): Promise<{ user: AuthUser; token: string }> {
    if (USE_MOCKS) {
      await new Promise((r) => setTimeout(r, 600));
      const cred = DEMO_CREDENTIALS[email];
      if (!cred || cred.password !== password) throw new Error("Invalid credentials");
      const user = mockUsers.find((u) => u.id === cred.userId)!;
      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          timezone: user.timezone,
          language: user.language,
        },
        token: "mock-jwt-token",
      };
    }
    return apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  async forgotPassword(email: string): Promise<void> {
    if (USE_MOCKS) {
      await new Promise((r) => setTimeout(r, 500));
      return;
    }
    return apiRequest("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(token: string, password: string): Promise<void> {
    if (USE_MOCKS) {
      await new Promise((r) => setTimeout(r, 500));
      return;
    }
    return apiRequest("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
  },

  async getMe(): Promise<AuthUser> {
    if (USE_MOCKS) {
      await new Promise((r) => setTimeout(r, 200));
      const user = mockUsers[0];
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
    return apiRequest("/auth/me");
  },
};
