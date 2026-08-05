import { mockLeads, mockNotes } from "@/mocks/data";
import type { Lead, Note } from "@/types";
import { USE_MOCKS, apiRequest } from "./api";

let leads = [...mockLeads];
let notes = [...mockNotes];

const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms));

export const leadService = {
  async getLeads(): Promise<Lead[]> {
    if (USE_MOCKS) { await delay(); return [...leads]; }
    return apiRequest("/leads");
  },

  async getLead(id: string): Promise<Lead> {
    if (USE_MOCKS) {
      await delay(200);
      const lead = leads.find((l) => l.id === id);
      if (!lead) throw new Error("Lead not found");
      return lead;
    }
    return apiRequest(`/leads/${id}`);
  },

  async createLead(data: Omit<Lead, "id" | "createdAt" | "updatedAt">): Promise<Lead> {
    if (USE_MOCKS) {
      await delay();
      const lead: Lead = {
        ...data,
        id: `l${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      leads = [lead, ...leads];
      return lead;
    }
    return apiRequest("/leads", { method: "POST", body: JSON.stringify(data) });
  },

  async updateLead(id: string, data: Partial<Lead>): Promise<Lead> {
    if (USE_MOCKS) {
      await delay();
      const idx = leads.findIndex((l) => l.id === id);
      if (idx === -1) throw new Error("Lead not found");
      leads[idx] = { ...leads[idx], ...data, updatedAt: new Date().toISOString() };
      return leads[idx];
    }
    return apiRequest(`/leads/${id}`, { method: "PATCH", body: JSON.stringify(data) });
  },

  async deleteLead(id: string): Promise<void> {
    if (USE_MOCKS) {
      await delay();
      leads = leads.filter((l) => l.id !== id);
      return;
    }
    return apiRequest(`/leads/${id}`, { method: "DELETE" });
  },

  async assignLead(id: string, userId: string): Promise<Lead> {
    return this.updateLead(id, { assignedUserId: userId });
  },

  async scorelead(id: string): Promise<Lead> {
    if (USE_MOCKS) {
      await delay(800);
      const score = Math.floor(Math.random() * 40) + 50;
      return this.updateLead(id, { score, temperature: score >= 70 ? "HOT" : score >= 50 ? "WARM" : "COLD" });
    }
    return apiRequest(`/leads/${id}/score`, { method: "POST" });
  },

  async getNotes(leadId: string): Promise<Note[]> {
    if (USE_MOCKS) {
      await delay(200);
      return notes.filter((n) => n.leadId === leadId);
    }
    return apiRequest(`/leads/${leadId}/notes`);
  },

  async addNote(leadId: string, content: string, userId: string, userName: string): Promise<Note> {
    if (USE_MOCKS) {
      await delay(300);
      const note: Note = {
        id: `n${Date.now()}`,
        leadId,
        content,
        userId,
        userName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      notes = [note, ...notes];
      return note;
    }
    return apiRequest(`/leads/${leadId}/notes`, { method: "POST", body: JSON.stringify({ content }) });
  },
};
