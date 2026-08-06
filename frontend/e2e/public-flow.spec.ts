import { test, expect } from "@playwright/test";

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
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({ timeout: 10000 });
}

test.describe("Public lead flow", () => {
  test("request demo → chat → book → CRM", async ({ page }) => {
    await clearClientState(page);

    await page.goto("/");
    await expect(page.getByText("AI Sales Assistant").first()).toBeVisible();

    await page.goto("/request-demo");
    await page.locator('input[name="firstName"]').fill("Flow");
    await page.locator('input[name="lastName"]').fill("Tester");
    await page.locator('input[name="companyName"]').fill("Flow Co");
    await page.locator('input[name="email"]').fill("flow.tester@example.com");

    await selectOption(page, "Select country", "United States");
    await selectOption(page, "Employees", /11–50/);
    await page.getByRole("button", { name: /Next/i }).click();

    await selectOption(page, "Select a service", "AI Automation");
    await selectOption(page, "Select budget", "More than $10,000");
    await selectOption(page, "Select timeline", "Immediately");
    await page.locator('textarea[name="projectDescription"]').fill(
      "We need full AI sales qualification for our SDR team."
    );
    await page.getByRole("button", { name: /Next/i }).click();

    await selectOption(page, "Select channel", "Email");
    await page.getByRole("checkbox").click();
    await page.getByRole("button", { name: /Submit Request/i }).click();

    await expect(page.getByText(/Request received/i)).toBeVisible({ timeout: 15000 });
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
        await page.waitForTimeout(700);
      }
    }

    await page.goto(`/book?leadId=${leadId}`);
    await expect(page.getByRole("heading", { name: /Book a Meeting/i })).toBeVisible();

    await page.getByRole("button", { name: /30-minute Discovery Call/i }).click();
    await expect(page.getByText(/Select a date/i)).toBeVisible();

    const dateButtons = page.locator("button:not([disabled])").filter({ hasText: /^[1-9]\d?$/ });
    await dateButtons.first().click();
    await expect(page.getByText(/Available slots/i)).toBeVisible();

    await page.locator("button").filter({ hasText: /^\d{2}:\d{2}$/ }).first().click();
    await expect(page.getByText(/Your information/i)).toBeVisible();

    await page.locator("#firstName").fill("Flow");
    await page.locator("#lastName").fill("Tester");
    await page.locator("#email").fill("flow.tester@example.com");
    await page.locator("#company").fill("Flow Co");

    await page.getByRole("button", { name: /Confirm Booking/i }).click();
    await expect(page.getByRole("heading", { name: /Meeting Confirmed/i })).toBeVisible({
      timeout: 20000,
    });

    await loginAs(page, "admin@aisales.demo", "Demo123!");

    await page.goto("/app/leads");
    await expect(page.getByText(/Flow/i).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/flow\.tester@example\.com|Tester/i).first()).toBeVisible({
      timeout: 10000,
    });

    await page.goto("/app/appointments");
    await expect(page.getByText(/Flow/i).first()).toBeVisible({ timeout: 15000 });

    await page.goto("/app/pipeline");
    await expect(page.getByText("Flow Tester").or(page.getByText("Flow Co")).first()).toBeVisible({
      timeout: 15000,
    });

    await page.goto("/app/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Total Leads")).toBeVisible();
  });
});

test.describe("RBAC", () => {
  test("sales representative cannot access admin pages", async ({ page }) => {
    await clearClientState(page);
    await loginAs(page, "sales@aisales.demo", "Demo123!");

    await page.goto("/app/audit-logs");
    await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    await page.goto("/app/settings");
    await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15000 });

    await page.goto("/app/team");
    await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15000 });
  });
});
