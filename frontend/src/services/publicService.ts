import type { Appointment, Conversation, Lead, Message } from "@/types";
import { apiClient } from "@/lib/apiClient";
import { getPublicToken, savePublicSession } from "@/lib/publicSession";
import type { CreateLeadInput } from "@/services/leadService";

export interface PublicLeadCreateResult {
  lead: Lead;
  conversationId: string;
  publicToken: string;
  expiresIn: number;
}

export interface QualificationInfo {
  score: number;
  temperature: Lead["temperature"];
  progress: number;
  missingFields: string[];
  recommendedAction: string;
}

export interface PublicMessageResult {
  conversation: Conversation;
  assistantMessage: Message;
  lead: Lead;
  qualification: QualificationInfo;
}

function publicHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getPublicToken();
  const headers: Record<string, string> = { ...extra };
  if (token) headers["X-Public-Token"] = token;
  return headers;
}

export const publicService = {
  async createLead(data: CreateLeadInput): Promise<PublicLeadCreateResult> {
    const result = await apiClient.post<PublicLeadCreateResult, CreateLeadInput>(
      "/public/leads",
      data,
      { skipAuth: true }
    );
    savePublicSession({
      leadId: result.lead.id,
      conversationId: result.conversationId,
      publicToken: result.publicToken,
    });
    return result;
  },

  async getLead(leadId: string): Promise<Lead> {
    return apiClient.get(`/public/leads/${leadId}`, {
      skipAuth: true,
      headers: publicHeaders(),
    });
  },

  async getOrCreateConversation(leadId: string): Promise<Conversation> {
    return apiClient.post(
      "/public/conversations",
      { leadId },
      { skipAuth: true, headers: publicHeaders() }
    );
  },

  async sendMessage(conversationId: string, content: string): Promise<PublicMessageResult> {
    return apiClient.post(
      `/public/conversations/${conversationId}/messages`,
      { content, sender: "user" },
      { skipAuth: true, headers: publicHeaders() }
    );
  },

  async qualify(
    conversationId: string,
    step: number,
    answer: string,
    leadId?: string
  ): Promise<PublicMessageResult> {
    return apiClient.post(
      `/public/conversations/${conversationId}/qualify`,
      { step, answer, leadId },
      { skipAuth: true, headers: publicHeaders() }
    );
  },

  async getSlots(date: string, userId?: string): Promise<string[]> {
    return apiClient.get("/public/calendar/slots", {
      skipAuth: true,
      headers: publicHeaders(),
      params: { date, userId },
    });
  },

  async createAppointment(
    data: Partial<Omit<Appointment, "id" | "createdAt">> & {
      date: string;
      time: string;
      duration: number;
      type: Appointment["type"];
      status: Appointment["status"];
      googleMeet: boolean;
      leadName: string;
      leadCompany: string;
      leadEmail: string;
      salespersonName: string;
      leadId?: string;
      assignedUserId?: string;
      notes?: string;
      meetingLink?: string;
      timezone?: string;
    },
    idempotencyKey?: string
  ): Promise<Appointment> {
    const headers = publicHeaders();
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    return apiClient.post("/public/appointments", data, { skipAuth: true, headers });
  },
};
