import { test, expect } from "@playwright/test";

/**
 * Full-stack e2e against real FastAPI + PostgreSQL.
 * Requires backend running with seed data and:
 *   VITE_USE_MOCKS=false
 *
 * Skip automatically when mocks are enabled.
 */

const USE_MOCKS = process.env.VITE_USE_MOCKS !== "false";

async function selectOption(
  page: import("@playwright/test").Page,
  placeholder: string,
  optionName: string | RegExp
) {
  await page.getByRole("combobox").filter({ hasText: placeholder }).click();
  await page.getByRole("option", { name: optionName }).click();
}

async function clearClientState(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.removeItem("ai-sales-mock-database");
    localStorage.removeItem("ai-sales-auth");
    localStorage.removeItem("auth-storage");
    sessionStorage.clear();
  });
}

async function loginAs(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /^Sign In$/i }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 20000 });
}

test.describe("API mode public flow (VITE_USE_MOCKS=false)", () => {
  test.skip(USE_MOCKS, "Requires VITE_USE_MOCKS=false and running FastAPI");

  test("request demo → chat → book → CRM via PostgreSQL", async ({ page }) => {
    await clearClientState(page);

    // Ensure mock repository is never the source of truth.
    // Persist API call log across full navigations (sessionStorage).
    await page.addInitScript(() => {
      const key = "__apiCalls";
      const existing = sessionStorage.getItem(key);
      const calls: string[] = existing ? (JSON.parse(existing) as string[]) : [];
      (window as unknown as { __apiCalls: string[] }).__apiCalls = calls;
      const original = window.fetch.bind(window);
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        calls.push(url);
        sessionStorage.setItem(key, JSON.stringify(calls));
        (window as unknown as { __apiCalls: string[] }).__apiCalls = calls;
        return original(input, init);
      };
    });

    const email = `api.flow.${Date.now()}@example.com`;

    await page.goto("/request-demo");
    await page.locator('input[name="firstName"]').fill("ApiFlow");
    await page.locator('input[name="lastName"]').fill("Tester");
    await page.locator('input[name="companyName"]').fill("Api Flow Co");
    await page.locator('input[name="email"]').fill(email);

    await selectOption(page, "Select country", "United States");
    await selectOption(page, "Employees", /11–50/);
    await page.getByRole("button", { name: /Next/i }).click();

    await selectOption(page, "Select a service", "AI Automation");
    await selectOption(page, "Select budget", "More than $10,000");
    await selectOption(page, "Select timeline", "Immediately");
    await page.locator('textarea[name="projectDescription"]').fill(
      "We need full AI sales qualification for our SDR team via real API."
    );
    await page.getByRole("button", { name: /Next/i }).click();

    await selectOption(page, "Select channel", "Email");
    await page.getByRole("checkbox").click();
    await page.getByRole("button", { name: /Submit Request/i }).click();

    await expect(page.getByText(/Request received/i)).toBeVisible({ timeout: 20000 });

    const publicToken = await page.evaluate(() => sessionStorage.getItem("publicToken"));
    expect(publicToken).toBeTruthy();

    await page.getByRole("button", { name: /Continue with AI Assistant/i }).click();
    await expect(page).toHaveURL(/\/chat\?leadId=/);
    const leadId = new URL(page.url()).searchParams.get("leadId");
    expect(leadId).toBeTruthy();

    for (const reply of [
      "I need AI automation",
      "Lead qualification",
      "HubSpot",
      "More than $10,000",
      "Immediately",
      "Yes, I decide",
    ]) {
      const btn = page.getByRole("button", { name: reply });
      if (await btn.count()) {
        await btn.first().click();
        await page.waitForTimeout(900);
      }
    }

    // Chat must have hit public conversation endpoints (not mockRepository)
    const chatCalls = await page.evaluate(() => {
      const raw = sessionStorage.getItem("__apiCalls");
      return raw ? (JSON.parse(raw) as string[]) : [];
    });
    expect(chatCalls.some((u) => u.includes("/public/leads"))).toBeTruthy();
    expect(chatCalls.some((u) => u.includes("/public/conversations"))).toBeTruthy();
    expect(chatCalls.every((u) => !u.includes("mockRepository"))).toBeTruthy();

    await page.goto(`/book?leadId=${leadId}`);
    await expect(page.getByRole("heading", { name: /Book a Meeting/i })).toBeVisible();
    await page.getByRole("button", { name: /30-minute Discovery Call/i }).click();

    const dateButtons = page.locator("button:not([disabled])").filter({ hasText: /^[1-9]\d?$/ });
    await dateButtons.first().click();
    await expect(page.getByText(/Available slots/i)).toBeVisible({ timeout: 15000 });
    await page.locator("button").filter({ hasText: /^\d{2}:\d{2}$/ }).first().click();

    await page.locator("#firstName").fill("ApiFlow");
    await page.locator("#lastName").fill("Tester");
    await page.locator("#email").fill(email);
    await page.locator("#company").fill("Api Flow Co");
    await page.getByRole("button", { name: /Confirm Booking/i }).click();
    await expect(page.getByRole("heading", { name: /Meeting Confirmed/i })).toBeVisible({
      timeout: 25000,
    });

    const apiCalls = await page.evaluate(() => {
      const raw = sessionStorage.getItem("__apiCalls");
      return raw ? (JSON.parse(raw) as string[]) : [];
    });
    expect(apiCalls.some((u) => u.includes("/public/leads"))).toBeTruthy();
    expect(apiCalls.some((u) => u.includes("/public/conversations"))).toBeTruthy();
    expect(
      apiCalls.some((u) => u.includes("/public/appointments") || u.includes("/public/calendar"))
    ).toBeTruthy();
    expect(apiCalls.every((u) => !u.includes("mockRepository"))).toBeTruthy();
    expect(apiCalls.every((u) => !u.includes("/mocks/"))).toBeTruthy();

    const mockDb = await page.evaluate(() => localStorage.getItem("ai-sales-mock-database"));
    expect(mockDb).toBeNull();

    await loginAs(page, "admin@aisales.demo", "Demo123!");

    const crmCalls = await page.evaluate(() => {
      const raw = sessionStorage.getItem("__apiCalls");
      return raw ? (JSON.parse(raw) as string[]) : [];
    });
    expect(crmCalls.some((u) => u.includes("/auth/login") || u.includes("/auth/"))).toBeTruthy();
    expect(crmCalls.every((u) => !u.includes("mockRepository"))).toBeTruthy();

    await page.goto("/app/leads");
    await expect(page.getByText(/ApiFlow/i).first()).toBeVisible({ timeout: 20000 });

    await page.goto("/app/appointments");
    await expect(page.getByText(/ApiFlow/i).first()).toBeVisible({ timeout: 15000 });

    await page.goto("/app/pipeline");
    await expect(page.getByText(/ApiFlow|Api Flow Co/i).first()).toBeVisible({ timeout: 15000 });

    await page.goto("/app/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Total Leads")).toBeVisible();

    const finalCalls = await page.evaluate(() => {
      const raw = sessionStorage.getItem("__apiCalls");
      return raw ? (JSON.parse(raw) as string[]) : [];
    });
    expect(finalCalls.some((u) => u.includes("/leads") || u.includes("/dashboard"))).toBeTruthy();
    expect(finalCalls.every((u) => !u.includes("mockRepository"))).toBeTruthy();
    expect(await page.evaluate(() => localStorage.getItem("ai-sales-mock-database"))).toBeNull();
  });
});
