import { mockConversations } from "@/mocks/data";
import type { Conversation, Message } from "@/types";
import { USE_MOCKS, apiRequest } from "./api";

let conversations = [...mockConversations];
const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms));

const AI_RESPONSES = [
  "Thank you for reaching out! Could you tell me more about your current setup?",
  "That's a great use case for AI automation. What's your estimated budget for this project?",
  "I understand your needs. When would you like to get started — immediately, or within the next 30 days?",
  "Are you the final decision-maker for this project, or will others be involved?",
  "Based on what you've shared, I'd estimate your lead score at around 75. Would you like to book a call with our team?",
  "I'll connect you with one of our specialists who can discuss the technical details.",
];

let responseIdx = 0;

export const conversationService = {
  async getConversations(): Promise<Conversation[]> {
    if (USE_MOCKS) { await delay(); return [...conversations]; }
    return apiRequest("/conversations");
  },

  async getConversation(id: string): Promise<Conversation> {
    if (USE_MOCKS) {
      await delay(200);
      const c = conversations.find((c) => c.id === id);
      if (!c) throw new Error("Not found");
      return { ...c };
    }
    return apiRequest(`/conversations/${id}`);
  },

  async sendMessage(conversationId: string, content: string, sender: "user" | "agent", senderName: string): Promise<Message> {
    if (USE_MOCKS) {
      await delay(300);
      const message: Message = {
        id: `m${Date.now()}`,
        conversationId,
        content,
        sender,
        senderName,
        timestamp: new Date().toISOString(),
        read: false,
      };
      const idx = conversations.findIndex((c) => c.id === conversationId);
      if (idx !== -1) {
        conversations[idx] = {
          ...conversations[idx],
          messages: [...conversations[idx].messages, message],
          lastMessage: content,
          lastMessageAt: message.timestamp,
        };
      }
      return message;
    }
    return apiRequest(`/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content, sender, senderName }),
    });
  },

  async getAIResponse(conversationId: string): Promise<Message> {
    if (USE_MOCKS) {
      await delay(1200);
      const content = AI_RESPONSES[responseIdx % AI_RESPONSES.length];
      responseIdx++;
      const message: Message = {
        id: `m${Date.now()}`,
        conversationId,
        content,
        sender: "ai",
        senderName: "Ava",
        timestamp: new Date().toISOString(),
        read: false,
      };
      const idx = conversations.findIndex((c) => c.id === conversationId);
      if (idx !== -1) {
        conversations[idx] = {
          ...conversations[idx],
          messages: [...conversations[idx].messages, message],
          lastMessage: content,
          lastMessageAt: message.timestamp,
        };
      }
      return message;
    }
    return apiRequest(`/conversations/${conversationId}/ai-reply`, { method: "POST" });
  },

  async requestHandoff(conversationId: string): Promise<Conversation> {
    if (USE_MOCKS) {
      await delay(300);
      const idx = conversations.findIndex((c) => c.id === conversationId);
      if (idx !== -1) {
        conversations[idx] = {
          ...conversations[idx],
          status: "human_handoff",
          humanHandoffRequested: true,
        };
        return conversations[idx];
      }
      throw new Error("Not found");
    }
    return apiRequest(`/conversations/${conversationId}/handoff`, { method: "POST" });
  },

  async closeConversation(conversationId: string): Promise<Conversation> {
    if (USE_MOCKS) {
      await delay(300);
      const idx = conversations.findIndex((c) => c.id === conversationId);
      if (idx !== -1) {
        conversations[idx] = { ...conversations[idx], status: "closed" };
        return conversations[idx];
      }
      throw new Error("Not found");
    }
    return apiRequest(`/conversations/${conversationId}/close`, { method: "POST" });
  },
};
