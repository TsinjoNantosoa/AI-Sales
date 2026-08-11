import { defineConfig, devices } from "@playwright/test";

const useMocks = process.env.VITE_USE_MOCKS !== "false";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run build && npm run preview -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      ...process.env,
      VITE_USE_MOCKS: useMocks ? "true" : "false",
      VITE_API_URL: process.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
