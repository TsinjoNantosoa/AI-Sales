export interface LeadFilters {
  search?: string;
  status?: string;
  temperature?: string;
  assignedUserId?: string;
  source?: string;
  archived?: boolean;
}

export const queryKeys = {
  leads: {
    all: ["leads"] as const,
    list: (filters?: LeadFilters) => ["leads", "list", filters ?? {}] as const,
    detail: (id: string) => ["leads", "detail", id] as const,
    notes: (id: string) => ["leads", "notes", id] as const,
  },
  dashboard: {
    overview: ["dashboard", "overview"] as const,
    timeseries: ["dashboard", "timeseries"] as const,
    pipeline: ["dashboard", "pipeline"] as const,
    sources: ["dashboard", "sources"] as const,
  },
  analytics: {
    all: ["analytics"] as const,
  },
  appointments: {
    all: ["appointments"] as const,
    detail: (id: string) => ["appointments", "detail", id] as const,
    slots: (date: string, userId: string) =>
      ["appointments", "slots", date, userId] as const,
  },
  tasks: {
    all: ["tasks"] as const,
  },
  conversations: {
    all: ["conversations"] as const,
    detail: (id: string) => ["conversations", "detail", id] as const,
  },
  notifications: {
    all: ["notifications"] as const,
  },
  automations: {
    workflows: ["automations", "workflows"] as const,
    executions: ["automations", "executions"] as const,
  },
  team: {
    all: ["team"] as const,
    detail: (id: string) => ["team", "detail", id] as const,
  },
  audit: {
    all: ["audit"] as const,
  },
  integrations: {
    all: ["integrations"] as const,
  },
  settings: {
    all: ["settings"] as const,
  },
  activities: {
    byLead: (leadId: string) => ["activities", "lead", leadId] as const,
    all: ["activities"] as const,
  },
} as const;
