import type { Lead, Note, LeadStatus, EmailLog } from "@/types";
import { USE_MOCKS } from "@/lib/constants";
import { apiClient } from "@/lib/apiClient";
import {
  getDatabase,
  createLead as repoCreateLead,
  updateLead as repoUpdateLead,
  deleteLead as repoDeleteLead,
  archiveLead as repoArchiveLead,
  assignLead as repoAssignLead,
  moveLead as repoMoveLead,
  addLeadNote,
} from "@/mocks/mockRepository";
import { computeLeadScore, temperatureFromScore } from "@/lib/score";

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

export interface CreateLeadInput {
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  phone?: string;
  country: string;
  language?: string;
  source?: Lead["source"];
  serviceInterest: string;
  budgetMin?: number;
  budgetMax?: number;
  timeline?: string;
  needDescription: string;
  estimatedValue?: number;
  consentGiven?: boolean;
  tags?: string[];
  priority?: Lead["priority"];
  assignedUserId?: string;
  status?: LeadStatus;
  score?: number;
  temperature?: Lead["temperature"];
  companySize?: string;
}

function scopeLeads(leads: Lead[], currentUserId?: string, role?: string): Lead[] {
  if (role === "SALES_REPRESENTATIVE" && currentUserId) {
    return leads.filter((l) => l.assignedUserId === currentUserId);
  }
  return leads;
}

export const leadService = {
  async getLeads(opts?: { currentUserId?: string; role?: string; includeArchived?: boolean }): Promise<Lead[]> {
    if (USE_MOCKS) {
      await delay();
      const db = getDatabase();
      let leads = scopeLeads(db.leads, opts?.currentUserId, opts?.role);
      if (!opts?.includeArchived) {
        leads = leads.filter((l) => !db.archivedLeadIds.includes(l.id));
      }
      return [...leads];
    }
    return apiClient.get("/leads", {
      params: { assigned_to_me: opts?.role === "SALES_REPRESENTATIVE" ? true : undefined },
    });
  },

  async getLead(id: string): Promise<Lead> {
    if (USE_MOCKS) {
      await delay(150);
      const lead = getDatabase().leads.find((l) => l.id === id);
      if (!lead) throw new Error("Lead not found");
      return lead;
    }
    return apiClient.get(`/leads/${id}`);
  },

  async createLead(data: CreateLeadInput): Promise<Lead> {
    if (USE_MOCKS) {
      await delay();
      const scoreBreakdown = computeLeadScore(data);
      const score = data.score ?? scoreBreakdown.total;
      const settings = getDatabase().settings;
      return repoCreateLead({
        firstName: data.firstName,
        lastName: data.lastName,
        companyName: data.companyName,
        email: data.email,
        phone: data.phone,
        country: data.country,
        language: data.language ?? "en",
        source: data.source ?? "Website",
        serviceInterest: data.serviceInterest,
        budgetMin: data.budgetMin,
        budgetMax: data.budgetMax,
        timeline: data.timeline,
        needDescription: data.needDescription,
        estimatedValue: data.estimatedValue,
        score,
        temperature: data.temperature ?? temperatureFromScore(score),
        status: data.status ?? "NEW",
        assignedUserId: data.assignedUserId ?? settings.leadManagement.defaultAssigneeId,
        consentGiven: data.consentGiven ?? true,
        tags: data.tags ?? [],
        priority: data.priority ?? "Medium",
      });
    }
    return apiClient.post("/leads", data);
  },

  async updateLead(id: string, data: Partial<Lead>): Promise<Lead> {
    if (USE_MOCKS) {
      await delay();
      return repoUpdateLead(id, data);
    }
    return apiClient.patch(`/leads/${id}`, data);
  },

  async deleteLead(id: string): Promise<void> {
    if (USE_MOCKS) {
      await delay();
      repoDeleteLead(id);
      return;
    }
    await apiClient.delete(`/leads/${id}`);
  },

  async archiveLead(id: string): Promise<Lead> {
    if (USE_MOCKS) {
      await delay();
      return repoArchiveLead(id);
    }
    return apiClient.post(`/leads/${id}/archive`);
  },

  async assignLead(id: string, userId: string): Promise<Lead> {
    if (USE_MOCKS) {
      await delay();
      return repoAssignLead(id, userId);
    }
    return apiClient.post(`/leads/${id}/assign`, { userId });
  },

  async moveLead(id: string, status: LeadStatus): Promise<Lead> {
    if (USE_MOCKS) {
      await delay();
      return repoMoveLead(id, status);
    }
    return apiClient.patch(`/leads/${id}`, { status });
  },

  async bulkUpdate(ids: string[], data: Partial<Lead>): Promise<void> {
    if (USE_MOCKS) {
      await delay();
      for (const id of ids) {
        if (data.status) repoMoveLead(id, data.status);
        else if (data.assignedUserId) repoAssignLead(id, data.assignedUserId);
        else repoUpdateLead(id, data);
      }
      return;
    }
    await apiClient.post("/leads/bulk", { ids, data });
  },

  async bulkArchive(ids: string[]): Promise<void> {
    if (USE_MOCKS) {
      await delay();
      ids.forEach((id) => repoArchiveLead(id));
      return;
    }
    await apiClient.post("/leads/bulk-archive", { ids });
  },

  async bulkDelete(ids: string[]): Promise<void> {
    if (USE_MOCKS) {
      await delay();
      ids.forEach((id) => repoDeleteLead(id));
      return;
    }
    await apiClient.post("/leads/bulk-delete", { ids });
  },

  async scoreLead(id: string): Promise<Lead> {
    if (USE_MOCKS) {
      await delay(500);
      const lead = getDatabase().leads.find((l) => l.id === id);
      if (!lead) throw new Error("Lead not found");
      const breakdown = computeLeadScore(lead);
      return repoUpdateLead(id, {
        score: breakdown.total,
        temperature: temperatureFromScore(breakdown.total),
      });
    }
    return apiClient.post(`/leads/${id}/score`);
  },

  async getNotes(leadId: string): Promise<Note[]> {
    if (USE_MOCKS) {
      await delay(150);
      return getDatabase().notes.filter((n) => n.leadId === leadId);
    }
    return apiClient.get(`/leads/${leadId}/notes`);
  },

  async getEmailLogs(leadId: string): Promise<EmailLog[]> {
    if (USE_MOCKS) {
      await delay(150);
      return getDatabase().emailLogs.filter((e) => e.leadId === leadId);
    }
    return apiClient.get(`/leads/${leadId}/emails`);
  },

  async addNote(leadId: string, content: string, userId: string, userName: string): Promise<Note> {
    if (USE_MOCKS) {
      await delay(200);
      return addLeadNote(leadId, content, userId, userName);
    }
    return apiClient.post(`/leads/${leadId}/notes`, { content });
  },

  async importLeads(rows: CreateLeadInput[]): Promise<{ imported: Lead[]; rejected: { row: number; reason: string }[] }> {
    if (USE_MOCKS) {
      await delay(500);
      const imported: Lead[] = [];
      const rejected: { row: number; reason: string }[] = [];
      rows.forEach((row, i) => {
        if (!row.email || !row.firstName || !row.lastName) {
          rejected.push({ row: i + 1, reason: "Missing required fields" });
          return;
        }
        imported.push(
          repoCreateLead({
            firstName: row.firstName,
            lastName: row.lastName,
            companyName: row.companyName || "Unknown",
            email: row.email,
            phone: row.phone,
            country: row.country || "Unknown",
            language: row.language || "en",
            source: row.source || "Manual",
            serviceInterest: row.serviceInterest || "Other",
            needDescription: row.needDescription || "Imported via CSV",
            score: row.score ?? 40,
            temperature: row.temperature ?? "WARM",
            status: row.status ?? "NEW",
            consentGiven: true,
            tags: ["imported"],
            priority: "Medium",
            assignedUserId: row.assignedUserId,
          })
        );
      });
      return { imported, rejected };
    }
    return apiClient.post("/leads/import", { rows });
  },
};

/** @deprecated use scoreLead */
export const scorelead = leadService.scoreLead.bind(leadService);
