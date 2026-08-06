import type { Conversation, Message, Lead } from "@/types";
import { USE_MOCKS } from "@/lib/constants";
import { apiClient } from "@/lib/apiClient";
import {
  getDatabase,
  createConversation,
  addMessage,
  requestHumanHandoff,
  applyQualificationAnswer,
  persistDatabase,
} from "@/mocks/mockRepository";

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

function assertConversationAccess(
  conv: Conversation,
  opts?: { currentUserId?: string; role?: string }
) {
  if (opts?.role !== "SALES_REPRESENTATIVE" || !opts.currentUserId) return;
  const myLeadIds = new Set(
    getDatabase()
      .leads.filter((l) => l.assignedUserId === opts.currentUserId)
      .map((l) => l.id)
  );
  if (conv.assignedUserId !== opts.currentUserId && !myLeadIds.has(conv.leadId)) {
    throw new ForbiddenError();
  }
}

export const conversationService = {
  async getConversations(opts?: { currentUserId?: string; role?: string }): Promise<Conversation[]> {
    if (USE_MOCKS) {
      await delay();
      let list = [...getDatabase().conversations];
      if (opts?.role === "SALES_REPRESENTATIVE" && opts.currentUserId) {
        const myLeadIds = new Set(
          getDatabase()
            .leads.filter((l) => l.assignedUserId === opts.currentUserId)
            .map((l) => l.id)
        );
        list = list.filter(
          (c) => c.assignedUserId === opts.currentUserId || myLeadIds.has(c.leadId)
        );
      }
      return list;
    }
    return apiClient.get("/conversations");
  },

  async getConversation(
    id: string,
    opts?: { currentUserId?: string; role?: string }
  ): Promise<Conversation> {
    if (USE_MOCKS) {
      await delay(150);
      const c = getDatabase().conversations.find((x) => x.id === id);
      if (!c) throw new Error("Not found");
      assertConversationAccess(c, opts);
      return c;
    }
    return apiClient.get(`/conversations/${id}`);
  },

  async getOrCreateForLead(leadId: string): Promise<Conversation> {
    if (USE_MOCKS) {
      await delay(150);
      const db = getDatabase();
      const existing = db.conversations.find(
        (c) => c.leadId === leadId && c.channel === "chatbot" && c.status !== "closed"
      );
      if (existing) return existing;
      const lead = db.leads.find((l) => l.id === leadId);
      if (!lead) throw new Error("Lead not found");
      return createConversation({
        leadId,
        leadName: `${lead.firstName} ${lead.lastName}`,
        leadCompany: lead.companyName,
        leadEmail: lead.email,
        channel: "chatbot",
        status: "ai_handled",
        assignedUserId: lead.assignedUserId,
        humanHandoffRequested: false,
      });
    }
    return apiClient.post("/conversations", { leadId });
  },

  async sendMessage(
    conversationId: string,
    content: string,
    sender: Message["sender"] = "user"
  ): Promise<Message> {
    if (USE_MOCKS) {
      await delay(200);
      return addMessage(conversationId, content, sender);
    }
    return apiClient.post(`/conversations/${conversationId}/messages`, { content, sender });
  },

  async applyQualification(
    leadId: string,
    conversationId: string,
    step: number,
    answer: string
  ): Promise<{ lead: Lead; score: number; temperature: Lead["temperature"]; becameHot: boolean }> {
    if (USE_MOCKS) {
      await delay(400);
      await addMessage(conversationId, answer, "user");
      return applyQualificationAnswer(leadId, step, answer);
    }
    return apiClient.post(`/conversations/${conversationId}/qualify`, { leadId, step, answer });
  },

  async getAIResponse(conversationId: string, userMessage: string): Promise<{ message: string }> {
    if (USE_MOCKS) {
      await delay(500);
      const reply = "Thanks for your message. Let me continue your qualification.";
      await addMessage(conversationId, reply, "ai");
      return { message: reply };
    }
    return apiClient.post(`/conversations/${conversationId}/ai-reply`, { message: userMessage });
  },

  async requestHandoff(conversationId: string): Promise<Conversation> {
    if (USE_MOCKS) {
      await delay();
      return requestHumanHandoff(conversationId);
    }
    return apiClient.post(`/conversations/${conversationId}/handoff`);
  },

  async closeConversation(conversationId: string): Promise<Conversation> {
    if (USE_MOCKS) {
      await delay();
      const db = getDatabase();
      const conv = db.conversations.find((c) => c.id === conversationId);
      if (!conv) throw new Error("Not found");
      conv.status = "closed";
      persistDatabase();
      return { ...conv };
    }
    return apiClient.post(`/conversations/${conversationId}/close`);
  },
};
