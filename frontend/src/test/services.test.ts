import { describe, it, expect, beforeEach } from "vitest";
import { authService } from "@/services/authService";
import { leadService } from "@/services/leadService";
import { appointmentService } from "@/services/appointmentService";
import {
  resetDatabase,
  getDatabase,
  moveLead,
  createLead,
} from "@/mocks/mockRepository";
import { computeLeadScore, temperatureFromScore } from "@/lib/score";
import { STORAGE_KEYS } from "@/lib/constants";

describe("authService", () => {
  it("logs in with valid admin credentials", async () => {
    const result = await authService.login("admin@aisales.demo", "Demo123!");
    expect(result.user.email).toBe("admin@aisales.demo");
    expect(result.user.role).toBe("ADMIN");
    expect(result.token).toBeTruthy();
  });

  it("rejects invalid credentials", async () => {
    await expect(authService.login("admin@aisales.demo", "wrong")).rejects.toThrow(
      "Invalid credentials"
    );
  });
});

describe("leadService", () => {
  beforeEach(() => {
    resetDatabase();
  });

  it("creates a lead that appears in the repository", async () => {
    const before = getDatabase().leads.length;
    const lead = await leadService.createLead({
      firstName: "Test",
      lastName: "Lead",
      companyName: "Acme",
      email: "test@acme.com",
      country: "France",
      serviceInterest: "AI Automation",
      needDescription: "Need automation for sales qualification process",
      source: "Website",
      consentGiven: true,
    });
    expect(lead.id).toBeTruthy();
    expect(lead.status).toBe("NEW");
    expect(getDatabase().leads.length).toBe(before + 1);
    expect(getDatabase().leads[0].email).toBe("test@acme.com");
  });

  it("changes lead status via moveLead", () => {
    const lead = getDatabase().leads[0];
    const updated = moveLead(lead.id, "QUALIFIED");
    expect(updated.status).toBe("QUALIFIED");
    expect(getDatabase().leads.find((l) => l.id === lead.id)?.status).toBe("QUALIFIED");
  });
});

describe("score", () => {
  it("computes temperature from score", () => {
    expect(temperatureFromScore(20)).toBe("COLD");
    expect(temperatureFromScore(50)).toBe("WARM");
    expect(temperatureFromScore(80)).toBe("HOT");
  });

  it("computes a coherent lead score", () => {
    const breakdown = computeLeadScore({
      firstName: "A",
      lastName: "B",
      email: "a@b.com",
      companyName: "Co",
      country: "US",
      serviceInterest: "AI Automation",
      needDescription: "We need a full AI sales qualification workflow for our team",
      budgetMax: 10000,
      timeline: "Immediately",
      decisionAuthority: "Yes, I decide",
      companySize: "51–200",
    });
    expect(breakdown.total).toBeGreaterThanOrEqual(70);
    expect(temperatureFromScore(breakdown.total)).toBe("HOT");
  });
});

describe("appointmentService", () => {
  beforeEach(() => {
    resetDatabase();
  });

  it("creates an appointment linked to a lead", async () => {
    const lead = getDatabase().leads[0];
    const appt = await appointmentService.createAppointment({
      leadId: lead.id,
      leadName: `${lead.firstName} ${lead.lastName}`,
      leadCompany: lead.companyName,
      leadEmail: lead.email,
      assignedUserId: "u2",
      salespersonName: "Sarah Johnson",
      date: "2030-01-15",
      time: "10:00",
      duration: 30,
      timezone: "America/New_York",
      type: "30-minute discovery call",
      status: "Confirmed",
      googleMeet: true,
      meetingLink: "https://meet.google.com/test",
    });
    expect(appt.id).toBeTruthy();
    expect(getDatabase().appointments[0].leadId).toBe(lead.id);
  });
});

describe("mockRepository persistence", () => {
  it("persists and reloads from localStorage", () => {
    resetDatabase();
    const before = getDatabase().leads.length;
    createLead({
      firstName: "Persist",
      lastName: "Test",
      companyName: "PersistCo",
      email: "persist@test.com",
      country: "US",
      language: "en",
      source: "Manual",
      serviceInterest: "Other",
      needDescription: "Persistence check for mock database",
      score: 45,
      temperature: "WARM",
      status: "NEW",
      consentGiven: true,
      tags: [],
      priority: "Medium",
    });
    const raw = localStorage.getItem(STORAGE_KEYS.mockDatabase);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).leads.length).toBe(before + 1);
  });
});
