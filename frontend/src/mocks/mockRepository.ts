import {
  mockUsers,
  mockLeads,
  mockConversations,
  mockAppointments,
  mockTasks,
  mockNotifications,
  mockWorkflows,
  mockWorkflowExecutions,
  mockAuditLogs,
  mockActivities,
  mockNotes,
  mockEmailLogs,
} from "./data";
import type {
  User,
  Lead,
  Conversation,
  Message,
  Appointment,
  Task,
  Notification,
  Workflow,
  WorkflowExecution,
  AuditLog,
  Activity,
  Integration,
  Note,
  EmailLog,
  Settings,
  DashboardOverview,
  AnalyticsData,
  LeadStatus,
  LeadTemperature,
} from "@/types";
import { STORAGE_KEYS } from "@/lib/constants";
import { relativeToNow, daysAgo, hoursAgo, minutesAgo, daysFromNow, dateOnlyFromNow } from "@/lib/dates";
import { temperatureFromScore } from "@/lib/score";

export interface MockDatabase {
  users: User[];
  leads: Lead[];
  conversations: Conversation[];
  messages: Message[];
  appointments: Appointment[];
  tasks: Task[];
  notifications: Notification[];
  workflows: Workflow[];
  workflowExecutions: WorkflowExecution[];
  auditLogs: AuditLog[];
  activities: Activity[];
  integrations: Integration[];
  settings: Settings;
  notes: Note[];
  emailLogs: EmailLog[];
  archivedLeadIds: string[];
}

const DEFAULT_SETTINGS: Settings = {
  general: {
    companyName: "AI Sales Assistant",
    timezone: "America/New_York",
    defaultLanguage: "en",
    currency: "USD",
    dateFormat: "MMM d, yyyy",
  },
  leadManagement: {
    autoAssign: true,
    defaultAssigneeId: "u2",
    duplicateDetection: true,
    archiveAfterDays: 90,
  },
  leadScoring: {
    hotThreshold: 70,
    warmThreshold: 40,
    autoQualifyAt: 70,
  },
  aiAssistant: {
    enabled: true,
    name: "Ava",
    tone: "professional",
    handoffThreshold: 3,
  },
  followUps: {
    enabled: true,
    firstFollowUpHours: 24,
    maxAttempts: 3,
  },
  emailTemplates: {
    welcomeSubject: "Welcome to AI Sales Assistant",
    meetingSubject: "Your meeting is confirmed",
    followUpSubject: "Following up on your inquiry",
  },
  notifications: {
    emailEnabled: true,
    inAppEnabled: true,
    hotLeadAlerts: true,
    meetingReminders: true,
  },
  security: {
    sessionTimeoutMinutes: 60,
    requireMfa: false,
    passwordMinLength: 8,
  },
  availability: {
    timezone: "America/New_York",
    bufferMinutes: 15,
    days: [
      { day: "Monday", enabled: true, start: "09:00", end: "18:00" },
      { day: "Tuesday", enabled: true, start: "09:00", end: "18:00" },
      { day: "Wednesday", enabled: true, start: "09:00", end: "18:00" },
      { day: "Thursday", enabled: true, start: "09:00", end: "18:00" },
      { day: "Friday", enabled: true, start: "09:00", end: "18:00" },
      { day: "Saturday", enabled: false, start: "09:00", end: "13:00" },
      { day: "Sunday", enabled: false, start: "09:00", end: "13:00" },
    ],
  },
};

const DEFAULT_INTEGRATIONS: Integration[] = [
  {
    id: "int1",
    name: "Google Calendar",
    description: "Sync meetings and availability",
    logo: "calendar",
    status: "connected",
    lastSync: hoursAgo(2),
    category: "Calendar",
  },
  {
    id: "int2",
    name: "Gmail",
    description: "Send and track emails",
    logo: "mail",
    status: "connected",
    lastSync: hoursAgo(5),
    category: "Email",
  },
  {
    id: "int3",
    name: "HubSpot",
    description: "Two-way CRM sync",
    logo: "hubspot",
    status: "available",
    category: "CRM",
  },
  {
    id: "int4",
    name: "Slack",
    description: "Team notifications",
    logo: "slack",
    status: "available",
    category: "Communication",
  },
  {
    id: "int5",
    name: "n8n",
    description: "Workflow automation bridge",
    logo: "n8n",
    status: "connected",
    lastSync: minutesAgo(30),
    category: "Automation",
  },
  {
    id: "int6",
    name: "OpenAI",
    description: "AI qualification engine (server-side)",
    logo: "openai",
    status: "connected",
    lastSync: minutesAgo(10),
    category: "AI",
  },
];

function refreshIsoDates<T extends object>(items: T[], dateFields: (keyof T & string)[]): T[] {
  return items.map((item) => {
    const next = { ...item } as T & Record<string, unknown>;
    for (const field of dateFields) {
      const val = next[field];
      if (typeof val === "string" && val.includes("2024-01")) {
        next[field] = relativeToNow(val) as T[typeof field];
      }
    }
    return next as T;
  });
}

function buildExtraAppointments(): Appointment[] {
  const extras: Appointment[] = [];
  for (let i = 0; i < 7; i++) {
    extras.push({
      id: `a-extra-${i + 1}`,
      leadId: mockLeads[i % mockLeads.length].id,
      leadName: `${mockLeads[i % mockLeads.length].firstName} ${mockLeads[i % mockLeads.length].lastName}`,
      leadCompany: mockLeads[i % mockLeads.length].companyName,
      leadEmail: mockLeads[i % mockLeads.length].email,
      assignedUserId: i % 2 === 0 ? "u2" : "u3",
      salespersonName: i % 2 === 0 ? "Sarah Johnson" : "Mike Torres",
      date: dateOnlyFromNow(i + 1),
      time: ["09:00", "10:30", "14:00", "15:30", "11:00"][i % 5],
      duration: [30, 15, 60][i % 3],
      timezone: "America/New_York",
      type: ["30-minute discovery call", "15-minute introduction", "60-minute technical consultation"][i % 3] as Appointment["type"],
      status: i === 6 ? "Proposed" : "Confirmed",
      meetingLink: `https://meet.google.com/demo-${i + 1}`,
      googleMeet: true,
      createdAt: daysAgo(i + 1),
    });
  }
  return extras;
}

function buildExtraNotifications(): Notification[] {
  const extras: Notification[] = [];
  for (let i = 0; i < 20; i++) {
    extras.push({
      id: `n-extra-${i + 1}`,
      title: [
        "New hot lead",
        "Meeting reminder",
        "Task due soon",
        "Lead scored",
        "Automation completed",
        "Lead assigned",
      ][i % 6],
      message: `Demo notification #${i + 1} for AI Sales Assistant`,
      category: (["leads", "meetings", "tasks", "automations", "system"] as const)[i % 5],
      read: i % 3 === 0,
      relatedId: mockLeads[i % mockLeads.length]?.id,
      relatedType: "lead",
      createdAt: hoursAgo(i * 3 + 1),
    });
  }
  return extras;
}

function buildExtraActivities(): Activity[] {
  const extras: Activity[] = [];
  for (let i = 0; i < 30; i++) {
    const lead = mockLeads[i % mockLeads.length];
    extras.push({
      id: `act-extra-${i + 1}`,
      leadId: lead.id,
      leadName: `${lead.firstName} ${lead.lastName}`,
      type: (["created", "updated", "message", "scored", "assigned", "status_changed", "note"] as const)[i % 7],
      description: `Activity #${i + 1}: update on ${lead.companyName}`,
      userId: ["u2", "u3", "u4"][i % 3],
      userName: ["Sarah Johnson", "Mike Torres", "Emma Wilson"][i % 3],
      createdAt: hoursAgo(i * 2 + 1),
    });
  }
  return extras;
}

function createSeedDatabase(): MockDatabase {
  const leads = refreshIsoDates(
    [...mockLeads],
    ["createdAt", "updatedAt", "lastInteractionAt", "nextFollowUpAt"]
  );

  const appointments = [
    ...refreshIsoDates([...mockAppointments], ["createdAt"]).map((a, i) => ({
      ...a,
      date: dateOnlyFromNow((i % 10) - 2),
    })),
    ...buildExtraAppointments(),
  ];

  const notifications = [
    ...refreshIsoDates([...mockNotifications], ["createdAt"]),
    ...buildExtraNotifications(),
  ];

  const activities = [
    ...refreshIsoDates([...mockActivities], ["createdAt"]),
    ...buildExtraActivities(),
  ];

  const conversations = refreshIsoDates([...mockConversations], ["createdAt", "lastMessageAt"]).map(
    (c) => ({
      ...c,
      messages: refreshIsoDates([...(c.messages ?? [])], ["timestamp"]),
    })
  );

  const messages = conversations.flatMap((c) => c.messages ?? []);

  return {
    users: refreshIsoDates([...mockUsers], ["createdAt", "lastActive"]),
    leads,
    conversations,
    messages,
    appointments,
    tasks: refreshIsoDates([...mockTasks], ["createdAt", "dueDate", "completedAt"]),
    notifications,
    workflows: [...mockWorkflows],
    workflowExecutions: refreshIsoDates([...mockWorkflowExecutions], ["startedAt"]),
    auditLogs: refreshIsoDates([...mockAuditLogs], ["timestamp"]),
    activities,
    integrations: DEFAULT_INTEGRATIONS,
    settings: DEFAULT_SETTINGS,
    notes: refreshIsoDates([...mockNotes], ["createdAt", "updatedAt"]),
    emailLogs: refreshIsoDates([...mockEmailLogs], ["sentAt"]),
    archivedLeadIds: [],
  };
}

let db: MockDatabase | null = null;

function uid(prefix: string) {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function persist() {
  if (!db) return;
  try {
    localStorage.setItem(STORAGE_KEYS.mockDatabase, JSON.stringify(db));
  } catch {
    // quota / private mode
  }
}

export function getDatabase(): MockDatabase {
  if (db) return db;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.mockDatabase);
    if (raw) {
      const parsed = JSON.parse(raw) as MockDatabase;
      if (parsed?.leads && Array.isArray(parsed.leads) && parsed.users) {
        db = {
          ...createSeedDatabase(),
          ...parsed,
          settings: {
            ...DEFAULT_SETTINGS,
            ...parsed.settings,
            general: { ...DEFAULT_SETTINGS.general, ...parsed.settings?.general },
            leadManagement: { ...DEFAULT_SETTINGS.leadManagement, ...parsed.settings?.leadManagement },
            leadScoring: { ...DEFAULT_SETTINGS.leadScoring, ...parsed.settings?.leadScoring },
            aiAssistant: { ...DEFAULT_SETTINGS.aiAssistant, ...parsed.settings?.aiAssistant },
            followUps: { ...DEFAULT_SETTINGS.followUps, ...parsed.settings?.followUps },
            emailTemplates: { ...DEFAULT_SETTINGS.emailTemplates, ...parsed.settings?.emailTemplates },
            notifications: { ...DEFAULT_SETTINGS.notifications, ...parsed.settings?.notifications },
            security: { ...DEFAULT_SETTINGS.security, ...parsed.settings?.security },
            availability: {
              ...DEFAULT_SETTINGS.availability,
              ...parsed.settings?.availability,
              days: parsed.settings?.availability?.days ?? DEFAULT_SETTINGS.availability.days,
            },
          },
        };
        return db;
      }
    }
  } catch {
    // corrupted
  }
  db = createSeedDatabase();
  persist();
  return db;
}

export function saveDatabase(next: MockDatabase) {
  db = next;
  persist();
}

export function resetDatabase() {
  localStorage.removeItem(STORAGE_KEYS.mockDatabase);
  db = createSeedDatabase();
  persist();
  return db;
}

function mutate(updater: (draft: MockDatabase) => void) {
  const draft = getDatabase();
  updater(draft);
  persist();
  return draft;
}

/** Force-persist current in-memory database (for service-level mutations). */
export function persistDatabase(): void {
  persist();
}

export function createLead(
  data: Omit<Lead, "id" | "createdAt" | "updatedAt"> & Partial<Pick<Lead, "id">>
): Lead {
  const now = new Date().toISOString();
  const lead: Lead = {
    ...data,
    id: data.id ?? uid("l"),
    createdAt: now,
    updatedAt: now,
  };
  mutate((d) => {
    d.leads = [lead, ...d.leads];
  });
  appendActivity({
    leadId: lead.id,
    leadName: `${lead.firstName} ${lead.lastName}`,
    type: "created",
    description: `Lead created from ${lead.source}`,
  });
  return lead;
}

export function updateLead(id: string, data: Partial<Lead>): Lead {
  let updated: Lead | undefined;
  mutate((d) => {
    const idx = d.leads.findIndex((l) => l.id === id);
    if (idx === -1) throw new Error("Lead not found");
    d.leads[idx] = { ...d.leads[idx], ...data, updatedAt: new Date().toISOString() };
    updated = d.leads[idx];
  });
  if (!updated) throw new Error("Lead not found");
  return updated;
}

export function deleteLead(id: string): void {
  mutate((d) => {
    d.leads = d.leads.filter((l) => l.id !== id);
    d.archivedLeadIds = d.archivedLeadIds.filter((x) => x !== id);
  });
}

export function archiveLead(id: string): Lead {
  mutate((d) => {
    if (!d.archivedLeadIds.includes(id)) d.archivedLeadIds.push(id);
  });
  return updateLead(id, { status: "INACTIVE" });
}

export function assignLead(id: string, userId: string): Lead {
  const lead = updateLead(id, { assignedUserId: userId });
  const user = getDatabase().users.find((u) => u.id === userId);
  appendActivity({
    leadId: id,
    leadName: `${lead.firstName} ${lead.lastName}`,
    type: "assigned",
    description: `Assigned to ${user ? `${user.firstName} ${user.lastName}` : userId}`,
    userId,
    userName: user ? `${user.firstName} ${user.lastName}` : undefined,
  });
  return lead;
}

export function moveLead(id: string, status: LeadStatus): Lead {
  const prev = getDatabase().leads.find((l) => l.id === id);
  const lead = updateLead(id, { status });
  appendActivity({
    leadId: id,
    leadName: `${lead.firstName} ${lead.lastName}`,
    type: "status_changed",
    description: `Status changed: ${prev?.status ?? "?"} → ${status}`,
  });
  return lead;
}

export function addLeadNote(leadId: string, content: string, userId: string, userName: string): Note {
  const note: Note = {
    id: uid("n"),
    leadId,
    content,
    userId,
    userName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  mutate((d) => {
    d.notes = [note, ...d.notes];
  });
  const lead = getDatabase().leads.find((l) => l.id === leadId);
  appendActivity({
    leadId,
    leadName: lead ? `${lead.firstName} ${lead.lastName}` : leadId,
    type: "note",
    description: `Note added: '${content.slice(0, 80)}'`,
    userId,
    userName,
  });
  return note;
}

export function createConversation(
  data: Omit<Conversation, "id" | "createdAt" | "messages" | "unreadCount" | "lastMessage" | "lastMessageAt"> & {
    messages?: Message[];
  }
): Conversation {
  const now = new Date().toISOString();
  const conversation: Conversation = {
    ...data,
    id: uid("c"),
    messages: data.messages ?? [],
    unreadCount: 0,
    lastMessage: data.messages?.[data.messages.length - 1]?.content ?? "",
    lastMessageAt: now,
    createdAt: now,
  };
  mutate((d) => {
    d.conversations = [conversation, ...d.conversations];
  });
  return conversation;
}

export function addMessage(
  conversationId: string,
  content: string,
  sender: Message["sender"],
  senderName?: string
): Message {
  const message: Message = {
    id: uid("m"),
    conversationId,
    content,
    sender,
    senderName,
    timestamp: new Date().toISOString(),
    read: sender !== "user",
  };
  mutate((d) => {
    const conv = d.conversations.find((c) => c.id === conversationId);
    if (!conv) throw new Error("Conversation not found");
    conv.messages = [...(conv.messages ?? []), message];
    conv.lastMessage = content;
    conv.lastMessageAt = message.timestamp;
    if (sender === "user") conv.unreadCount += 1;
    d.messages = [...d.messages, message];
  });
  return message;
}

export function requestHumanHandoff(conversationId: string): Conversation {
  let updated: Conversation | undefined;
  mutate((d) => {
    const conv = d.conversations.find((c) => c.id === conversationId);
    if (!conv) throw new Error("Conversation not found");
    conv.humanHandoffRequested = true;
    conv.status = "human_handoff";
    updated = conv;
  });
  if (!updated) throw new Error("Conversation not found");
  createNotification({
    title: "Human handoff requested",
    message: `${updated.leadName} requested a human agent`,
    category: "leads",
    relatedId: updated.leadId,
    relatedType: "lead",
  });
  return updated;
}

export function createAppointment(
  data: Omit<Appointment, "id" | "createdAt">
): Appointment {
  const appt: Appointment = {
    ...data,
    id: uid("a"),
    createdAt: new Date().toISOString(),
  };
  mutate((d) => {
    d.appointments = [appt, ...d.appointments];
  });
  appendActivity({
    leadId: appt.leadId,
    leadName: appt.leadName,
    type: "appointment",
    description: `Meeting booked: ${appt.type} on ${appt.date} at ${appt.time}`,
  });
  createNotification({
    title: "Meeting booked",
    message: `${appt.leadName} booked a ${appt.type}`,
    category: "meetings",
    relatedId: appt.id,
    relatedType: "appointment",
  });
  return appt;
}

export function updateAppointment(id: string, data: Partial<Appointment>): Appointment {
  let updated: Appointment | undefined;
  mutate((d) => {
    const idx = d.appointments.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error("Appointment not found");
    d.appointments[idx] = { ...d.appointments[idx], ...data };
    updated = d.appointments[idx];
  });
  if (!updated) throw new Error("Appointment not found");
  return updated;
}

export function cancelAppointment(id: string): Appointment {
  return updateAppointment(id, { status: "Cancelled" });
}

export function createTask(data: Omit<Task, "id" | "createdAt">): Task {
  const task: Task = { ...data, id: uid("t"), createdAt: new Date().toISOString() };
  mutate((d) => {
    d.tasks = [task, ...d.tasks];
  });
  if (task.leadId) {
    appendActivity({
      leadId: task.leadId,
      leadName: task.leadName ?? "",
      type: "task",
      description: `Task created: ${task.title}`,
    });
  }
  return task;
}

export function updateTask(id: string, data: Partial<Task>): Task {
  let updated: Task | undefined;
  mutate((d) => {
    const idx = d.tasks.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error("Task not found");
    d.tasks[idx] = { ...d.tasks[idx], ...data };
    updated = d.tasks[idx];
  });
  if (!updated) throw new Error("Task not found");
  return updated;
}

export function completeTask(id: string): Task {
  return updateTask(id, { status: "Completed", completedAt: new Date().toISOString() });
}

export function createNotification(
  data: Omit<Notification, "id" | "createdAt" | "read"> & { read?: boolean }
): Notification {
  const notification: Notification = {
    ...data,
    id: uid("notif"),
    read: data.read ?? false,
    createdAt: new Date().toISOString(),
  };
  mutate((d) => {
    d.notifications = [notification, ...d.notifications];
  });
  return notification;
}

export function markNotificationRead(id: string): Notification {
  let updated: Notification | undefined;
  mutate((d) => {
    const n = d.notifications.find((x) => x.id === id);
    if (!n) throw new Error("Notification not found");
    n.read = true;
    updated = n;
  });
  if (!updated) throw new Error("Notification not found");
  return updated;
}

export function createUser(data: Omit<User, "id" | "createdAt" | "assignedLeads" | "activeOpportunities" | "meetings" | "conversionRate" | "lastActive"> & Partial<User>): User {
  const user: User = {
    assignedLeads: 0,
    activeOpportunities: 0,
    meetings: 0,
    conversionRate: 0,
    lastActive: new Date().toISOString(),
    ...data,
    id: data.id ?? uid("u"),
    createdAt: new Date().toISOString(),
  };
  mutate((d) => {
    d.users = [...d.users, user];
  });
  appendAuditLog({
    userId: "system",
    userName: "System",
    action: "user.invite",
    entity: "user",
    entityId: user.id,
    ip: "127.0.0.1",
    result: "success",
    details: `Invited ${user.email} as ${user.role}`,
  });
  return user;
}

export function updateUser(id: string, data: Partial<User>): User {
  let updated: User | undefined;
  mutate((d) => {
    const idx = d.users.findIndex((u) => u.id === id);
    if (idx === -1) throw new Error("User not found");
    d.users[idx] = { ...d.users[idx], ...data };
    updated = d.users[idx];
  });
  if (!updated) throw new Error("User not found");
  appendAuditLog({
    userId: "system",
    userName: "System",
    action: "user.update",
    entity: "user",
    entityId: id,
    ip: "127.0.0.1",
    result: "success",
    details: `Updated user ${updated.email}`,
  });
  return updated;
}

export function deleteUser(id: string): void {
  mutate((d) => {
    d.users = d.users.filter((u) => u.id !== id);
  });
  appendAuditLog({
    userId: "system",
    userName: "System",
    action: "user.delete",
    entity: "user",
    entityId: id,
    ip: "127.0.0.1",
    result: "success",
    details: `Deleted user ${id}`,
  });
}

export function updateIntegration(id: string, data: Partial<Integration>): Integration {
  let updated: Integration | undefined;
  mutate((d) => {
    const idx = d.integrations.findIndex((i) => i.id === id);
    if (idx === -1) throw new Error("Integration not found");
    d.integrations[idx] = { ...d.integrations[idx], ...data };
    updated = d.integrations[idx];
  });
  if (!updated) throw new Error("Integration not found");
  return updated;
}

export function updateSettings(data: Partial<Settings>): Settings {
  let settings: Settings = DEFAULT_SETTINGS;
  mutate((d) => {
    d.settings = {
      ...d.settings,
      ...data,
      general: { ...d.settings.general, ...data.general },
      leadManagement: { ...d.settings.leadManagement, ...data.leadManagement },
      leadScoring: { ...d.settings.leadScoring, ...data.leadScoring },
      aiAssistant: { ...d.settings.aiAssistant, ...data.aiAssistant },
      followUps: { ...d.settings.followUps, ...data.followUps },
      emailTemplates: { ...d.settings.emailTemplates, ...data.emailTemplates },
      notifications: { ...d.settings.notifications, ...data.notifications },
      security: { ...d.settings.security, ...data.security },
      availability: {
        ...d.settings.availability,
        ...data.availability,
        days: data.availability?.days ?? d.settings.availability?.days ?? DEFAULT_SETTINGS.availability.days,
      },
    };
    settings = d.settings;
  });
  return settings;
}

export function appendAuditLog(
  data: Omit<AuditLog, "id" | "timestamp">
): AuditLog {
  const log: AuditLog = {
    ...data,
    id: uid("aud"),
    timestamp: new Date().toISOString(),
  };
  mutate((d) => {
    d.auditLogs = [log, ...d.auditLogs];
  });
  return log;
}

export function appendActivity(
  data: Omit<Activity, "id" | "createdAt">
): Activity {
  const activity: Activity = {
    ...data,
    id: uid("act"),
    createdAt: new Date().toISOString(),
  };
  mutate((d) => {
    d.activities = [activity, ...d.activities];
  });
  return activity;
}

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFYING: "Qualifying",
  QUALIFIED: "Qualified",
  MEETING_SCHEDULED: "Meeting",
  PROPOSAL_SENT: "Proposal",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
  INACTIVE: "Inactive",
};

export function computeDashboardOverview(assignedUserId?: string): DashboardOverview {
  const { leads, appointments } = getDatabase();
  const scoped = assignedUserId
    ? leads.filter((l) => l.assignedUserId === assignedUserId)
    : leads;
  const active = scoped.filter((l) => l.status !== "INACTIVE" && l.status !== "LOST");
  const won = scoped.filter((l) => l.status === "WON");
  const meetings = appointments.filter(
    (a) =>
      a.status !== "Cancelled" &&
      (!assignedUserId || a.assignedUserId === assignedUserId)
  );
  const pipelineValue = active
    .filter((l) => l.status !== "WON")
    .reduce((sum, l) => sum + (l.estimatedValue ?? 0), 0);
  const conversionRate =
    scoped.length === 0 ? 0 : Math.round((won.length / scoped.length) * 1000) / 10;

  return {
    totalLeads: scoped.length,
    newLeads: scoped.filter((l) => l.status === "NEW").length,
    qualifiedLeads: scoped.filter((l) =>
      ["QUALIFIED", "MEETING_SCHEDULED", "PROPOSAL_SENT", "NEGOTIATION", "WON"].includes(l.status)
    ).length,
    hotLeads: scoped.filter((l) => l.temperature === "HOT").length,
    meetingsBooked: meetings.length,
    conversionRate,
    pipelineValue,
    averageResponseTimeSeconds: 102,
    avgResponseTime: "1m 42s",
    changes: {
      totalLeads: 4.2,
      newLeads: 8.1,
      qualifiedLeads: 3.5,
      hotLeads: 6.0,
      meetingsBooked: 2.4,
      conversionRate: 1.1,
      pipelineValue: 5.6,
    },
  };
}

export function computeAnalytics(assignedUserId?: string): AnalyticsData {
  const { leads, appointments, users, workflows, workflowExecutions } = getDatabase();
  const scoped = assignedUserId
    ? leads.filter((l) => l.assignedUserId === assignedUserId)
    : leads;

  const leadTrend = Array.from({ length: 14 }, (_, i) => {
    const date = daysAgo(13 - i).slice(0, 10);
    const dayLeads = scoped.filter((l) => l.createdAt.slice(0, 10) <= date);
    return {
      date,
      leads: Math.max(1, Math.floor(dayLeads.length * ((i + 3) / 16))),
      qualified: Math.max(0, Math.floor(dayLeads.filter((l) => l.score >= 70).length * ((i + 2) / 16))),
    };
  });

  const funnel = (Object.keys(STATUS_LABELS) as LeadStatus[])
    .filter((s) => s !== "INACTIVE" && s !== "LOST")
    .map((status) => ({
      status,
      label: STATUS_LABELS[status],
      count: scoped.filter((l) => l.status === status).length,
      value: scoped
        .filter((l) => l.status === status)
        .reduce((sum, l) => sum + (l.estimatedValue ?? 0), 0),
    }));

  const sourceMap = new Map<string, Lead[]>();
  scoped.forEach((l) => {
    const list = sourceMap.get(l.source) ?? [];
    list.push(l);
    sourceMap.set(l.source, list);
  });

  const sources = Array.from(sourceMap.entries()).map(([source, list]) => {
    const qualified = list.filter((l) => l.score >= 70).length;
    const won = list.filter((l) => l.status === "WON").length;
    return {
      source,
      count: list.length,
      qualificationRate: list.length ? Math.round((qualified / list.length) * 100) : 0,
      conversionRate: list.length ? Math.round((won / list.length) * 100) : 0,
      pipelineValue: list.reduce((s, l) => s + (l.estimatedValue ?? 0), 0),
    };
  });

  const teamPerformance = users
    .filter((u) => u.role !== "ADMIN" && u.status === "active")
    .map((u) => {
      const assigned = leads.filter((l) => l.assignedUserId === u.id);
      const qualified = assigned.filter((l) => l.score >= 70);
      const wins = assigned.filter((l) => l.status === "WON");
      const meetings = appointments.filter((a) => a.assignedUserId === u.id).length;
      return {
        userId: u.id,
        name: `${u.firstName} ${u.lastName}`,
        assignedLeads: assigned.length,
        qualifiedLeads: qualified.length,
        meetings,
        wins: wins.length,
        conversionRate: assigned.length
          ? Math.round((wins.length / assigned.length) * 1000) / 10
          : 0,
        revenue: wins.reduce((s, l) => s + (l.estimatedValue ?? 0), 0),
      };
    });

  const automationPerformance = workflows.map((w) => {
    const execs = workflowExecutions.filter((e) => e.workflowId === w.id);
    const failed = execs.filter((e) => e.status === "Failed").length;
    return {
      workflowId: w.id,
      workflowName: w.name,
      executions: w.totalExecutions || execs.length,
      successRate: w.successRate,
      averageDurationMs: 2200,
      failedExecutions: w.errors || failed,
      recoveredExecutions: Math.floor((w.errors || failed) * 0.7),
    };
  });

  return {
    leadTrend,
    funnel,
    sources,
    teamPerformance,
    automationPerformance,
    avgTimeByStage: [
      { stage: "New → Contacted", days: 0.4 },
      { stage: "Contacted → Qualifying", days: 2.1 },
      { stage: "Qualifying → Qualified", days: 3.8 },
      { stage: "Qualified → Meeting", days: 1.9 },
      { stage: "Meeting → Proposal", days: 2.4 },
      { stage: "Proposal → Negotiation", days: 5.2 },
      { stage: "Negotiation → Won", days: 7.8 },
    ],
    aiPerformance: {
      conversationsHandled: getDatabase().conversations.length * 12,
      qualificationRate: 78.4,
      avgScore:
        scoped.length === 0
          ? 0
          : Math.round(scoped.reduce((s, l) => s + l.score, 0) / scoped.length),
      humanHandoffRate: 12.6,
      appointmentRate: 34.2,
    },
  };
}

export function applyQualificationAnswer(
  leadId: string,
  step: number,
  answer: string
): { lead: Lead; score: number; temperature: LeadTemperature; becameHot: boolean } {
  const lead = getDatabase().leads.find((l) => l.id === leadId);
  if (!lead) throw new Error("Lead not found");

  const patch: Partial<Lead> = { lastInteractionAt: new Date().toISOString() };
  const lower = answer.toLowerCase();

  if (step === 1) {
    if (lower.includes("lead")) patch.serviceInterest = "AI Automation";
    else if (lower.includes("follow")) patch.serviceInterest = "CRM Automation";
    else if (lower.includes("calendar")) patch.serviceInterest = "n8n Workflow Development";
    else if (lower.includes("data")) patch.serviceInterest = "Custom Software Development";
  }
  if (step === 3) {
    if (lower.includes("more than")) {
      patch.budgetMin = 10000;
      patch.budgetMax = 25000;
      patch.estimatedValue = 15000;
    } else if (lower.includes("$5,000")) {
      patch.budgetMin = 5000;
      patch.budgetMax = 10000;
      patch.estimatedValue = 7500;
    } else if (lower.includes("$3,000")) {
      patch.budgetMin = 3000;
      patch.budgetMax = 5000;
      patch.estimatedValue = 4000;
    } else if (lower.includes("$1,000")) {
      patch.budgetMin = 1000;
      patch.budgetMax = 3000;
      patch.estimatedValue = 2000;
    } else {
      patch.budgetMax = 1000;
      patch.estimatedValue = 800;
    }
  }
  if (step === 4) {
    if (lower.includes("immediately")) patch.timeline = "Immediately";
    else if (lower.includes("30")) patch.timeline = "Within 30 days";
    else patch.timeline = "Within 3 months";
  }

  const base = 25 + step * 12;
  let bonus = 0;
  if (patch.budgetMax && patch.budgetMax >= 5000) bonus += 15;
  if (patch.timeline === "Immediately") bonus += 12;
  else if (patch.timeline === "Within 30 days") bonus += 8;
  if (lower.includes("yes") || lower.includes("decide")) bonus += 10;
  if (patch.serviceInterest) bonus += 8;

  const score = Math.min(100, base + bonus);
  const temperature = temperatureFromScore(score);
  const wasHot = lead.temperature === "HOT";
  const status: LeadStatus =
    score >= 70 ? "QUALIFIED" : score >= 40 ? "QUALIFYING" : lead.status === "NEW" ? "CONTACTED" : lead.status;

  const updated = updateLead(leadId, {
    ...patch,
    score,
    temperature,
    status,
  });

  const becameHot = !wasHot && temperature === "HOT";
  if (becameHot) {
    createNotification({
      title: "Hot lead detected",
      message: `${updated.firstName} ${updated.lastName} reached score ${score}`,
      category: "leads",
      relatedId: updated.id,
      relatedType: "lead",
    });
  }

  appendActivity({
    leadId,
    leadName: `${updated.firstName} ${updated.lastName}`,
    type: "scored",
    description: `AI qualification update (step ${step}): score ${score}, ${temperature}`,
  });

  return { lead: updated, score, temperature, becameHot };
}

export { getGoogleCalendarUrl } from "@/lib/calendar";

// silence unused daysFromNow if tree-shaken poorly
void daysFromNow;
