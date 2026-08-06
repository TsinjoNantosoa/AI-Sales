export const STORAGE_KEYS = {
  auth: "ai-sales-auth",
  preferences: "ai-sales-preferences",
  mockDatabase: "ai-sales-mock-database",
} as const;

export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== "false";

export const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

export const APP_NAME =
  import.meta.env.VITE_APP_NAME || "AI Sales Assistant";

export const DEMO_PASSWORDS: Record<string, string> = {
  "admin@aisales.demo": "Demo123!",
  "manager@aisales.demo": "Demo123!",
  "sales@aisales.demo": "Demo123!",
};

export const DEFAULT_ASSIGNEE_ID = "u2";
