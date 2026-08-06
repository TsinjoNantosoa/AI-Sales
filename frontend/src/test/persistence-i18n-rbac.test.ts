import { describe, it, expect, beforeEach } from "vitest";
import { translate } from "@/hooks/useTranslation";
import { translations } from "@/lib/i18n";
import {
  resetDatabase,
  getDatabase,
  persistDatabase,
  saveDatabase,
} from "@/mocks/mockRepository";
import { automationService } from "@/services/automationService";
import { notificationService } from "@/services/notificationService";
import { conversationService } from "@/services/conversationService";
import { taskService } from "@/services/taskService";
import { leadService } from "@/services/leadService";
import { settingsService } from "@/services/settingsService";
import { integrationService } from "@/services/integrationService";
import { STORAGE_KEYS } from "@/lib/constants";

describe("i18n", () => {
  it("translates English and French lead status keys", () => {
    expect(translate("en", "status.NEW")).toBe("New");
    expect(translate("fr", "status.NEW")).toBe(translations.fr.status.NEW);
    expect(translate("en", "status.WON")).toBeTruthy();
    expect(translate("fr", "status.WON")).toBeTruthy();
  });

  it("translates common and toast keys in both languages", () => {
    expect(translate("en", "common.save")).toBeTruthy();
    expect(translate("fr", "common.save")).toBeTruthy();
    expect(translate("en", "toast.saved")).toBeTruthy();
    expect(translate("fr", "toast.saved")).toBeTruthy();
  });

  it("keeps EN and FR key parity for status and toast", () => {
    expect(Object.keys(translations.fr.status).sort()).toEqual(
      Object.keys(translations.en.status).sort()
    );
    expect(Object.keys(translations.fr.toast).sort()).toEqual(
      Object.keys(translations.en.toast).sort()
    );
  });
});

describe("mock persistence", () => {
  beforeEach(() => {
    resetDatabase();
  });

  it("persists workflow toggle to localStorage and after saveDatabase reload", async () => {
    const workflows = await automationService.getWorkflows();
    const target = workflows[0];
    const previous = target.status;
    const next = await automationService.toggleWorkflow(target.id);
    expect(next.status).not.toBe(previous);

    const raw = localStorage.getItem(STORAGE_KEYS.mockDatabase);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.workflows.find((w: { id: string }) => w.id === target.id)?.status).toBe(
      next.status
    );

    saveDatabase(parsed);
    const reloaded = await automationService.getWorkflows();
    expect(reloaded.find((w) => w.id === target.id)?.status).toBe(next.status);
  });

  it("persists markAllRead notifications", async () => {
    await notificationService.markAllRead();
    const raw = localStorage.getItem(STORAGE_KEYS.mockDatabase);
    const parsed = JSON.parse(raw!);
    expect(parsed.notifications.every((n: { read: boolean }) => n.read)).toBe(true);
  });

  it("persists closed conversations", async () => {
    const list = await conversationService.getConversations();
    const id = list[0].id;
    await conversationService.closeConversation(id);
    const raw = localStorage.getItem(STORAGE_KEYS.mockDatabase);
    const parsed = JSON.parse(raw!);
    expect(parsed.conversations.find((c: { id: string }) => c.id === id)?.status).toBe("closed");
  });

  it("persists task deletion", async () => {
    const tasks = await taskService.getTasks();
    const id = tasks[0].id;
    await taskService.deleteTask(id);
    const raw = localStorage.getItem(STORAGE_KEYS.mockDatabase);
    const parsed = JSON.parse(raw!);
    expect(parsed.tasks.some((t: { id: string }) => t.id === id)).toBe(false);
  });

  it("persists settings availability", async () => {
    const current = getDatabase().settings;
    await settingsService.updateSettings({
      availability: {
        timezone: "Europe/Paris",
        bufferMinutes: 20,
        days: current.availability.days.map((d) =>
          d.day === "Saturday" ? { ...d, enabled: true } : d
        ),
      },
    });
    const raw = localStorage.getItem(STORAGE_KEYS.mockDatabase);
    const parsed = JSON.parse(raw!);
    expect(parsed.settings.availability.timezone).toBe("Europe/Paris");
    expect(parsed.settings.availability.bufferMinutes).toBe(20);
    expect(
      parsed.settings.availability.days.find((d: { day: string }) => d.day === "Saturday")?.enabled
    ).toBe(true);
  });
});

describe("RBAC by id", () => {
  beforeEach(() => {
    resetDatabase();
  });

  it("blocks sales rep from another user's lead by id", async () => {
    const foreign = getDatabase().leads.find((l) => l.assignedUserId && l.assignedUserId !== "u3");
    expect(foreign).toBeTruthy();
    await expect(
      leadService.getLead(foreign!.id, {
        currentUserId: "u3",
        role: "SALES_REPRESENTATIVE",
      })
    ).rejects.toThrow("Forbidden");
  });

  it("allows sales rep to access own lead by id", async () => {
    let own = getDatabase().leads.find((l) => l.assignedUserId === "u3");
    if (!own) {
      own = getDatabase().leads[0];
      own.assignedUserId = "u3";
      persistDatabase();
    }
    const loaded = await leadService.getLead(own.id, {
      currentUserId: "u3",
      role: "SALES_REPRESENTATIVE",
    });
    expect(loaded.id).toBe(own.id);
  });
});

describe("settings and integrations services", () => {
  beforeEach(() => {
    resetDatabase();
  });

  it("updates and reloads settings", async () => {
    const current = getDatabase().settings;
    await settingsService.updateSettings({
      general: { ...current.general, companyName: "Demo Corp" },
    });
    const settings = await settingsService.getSettings();
    expect(settings.general.companyName).toBe("Demo Corp");
  });

  it("connects and disconnects an integration with persistence", async () => {
    const list = await integrationService.getIntegrations();
    const available = list.find((i) => i.status === "available") ?? list[0];
    await integrationService.connect(available.id);
    let raw = localStorage.getItem(STORAGE_KEYS.mockDatabase);
    expect(
      JSON.parse(raw!).integrations.find((i: { id: string }) => i.id === available.id)?.status
    ).toBe("connected");
    await integrationService.disconnect(available.id);
    raw = localStorage.getItem(STORAGE_KEYS.mockDatabase);
    expect(
      JSON.parse(raw!).integrations.find((i: { id: string }) => i.id === available.id)?.status
    ).toBe("available");
  });
});

describe("demo conversations volume", () => {
  it("has at least 12 conversations", () => {
    resetDatabase();
    expect(getDatabase().conversations.length).toBeGreaterThanOrEqual(12);
  });
});
