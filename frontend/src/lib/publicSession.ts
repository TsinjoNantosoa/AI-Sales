/** Session-only public visitor state (never mixed with CRM JWT). */

const KEYS = {
  leadId: "publicLeadId",
  conversationId: "publicConversationId",
  token: "publicToken",
} as const;

export interface PublicSession {
  leadId: string;
  conversationId: string;
  publicToken: string;
}

export function savePublicSession(session: PublicSession): void {
  sessionStorage.setItem(KEYS.leadId, session.leadId);
  sessionStorage.setItem(KEYS.conversationId, session.conversationId);
  sessionStorage.setItem(KEYS.token, session.publicToken);
}

export function getPublicSession(): PublicSession | null {
  const leadId = sessionStorage.getItem(KEYS.leadId);
  const conversationId = sessionStorage.getItem(KEYS.conversationId);
  const publicToken = sessionStorage.getItem(KEYS.token);
  if (!leadId || !publicToken) return null;
  return {
    leadId,
    conversationId: conversationId || "",
    publicToken,
  };
}

export function getPublicToken(): string | null {
  return sessionStorage.getItem(KEYS.token);
}

export function getPublicLeadId(): string | null {
  return sessionStorage.getItem(KEYS.leadId);
}

export function clearPublicSession(): void {
  sessionStorage.removeItem(KEYS.leadId);
  sessionStorage.removeItem(KEYS.conversationId);
  sessionStorage.removeItem(KEYS.token);
}
