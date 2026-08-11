import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser } from "@/types";
import { STORAGE_KEYS } from "@/lib/constants";
import { USE_MOCKS } from "@/lib/constants";
import { apiClient } from "@/lib/apiClient";

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  login: (user: AuthUser, token: string, refreshToken?: string | null) => void;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<AuthUser>) => void;
  setHasHydrated: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      hasHydrated: false,
      login: (user, token, refreshToken = null) =>
        set({ user, token, refreshToken, isAuthenticated: true }),
      logout: async () => {
        const { token, refreshToken } = get();
        if (!USE_MOCKS && token) {
          try {
            await apiClient.post(
              "/auth/logout",
              { refreshToken },
              { skipAuth: false }
            );
          } catch {
            // still clear local session
          }
        }
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
      },
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: STORAGE_KEYS.auth,
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
