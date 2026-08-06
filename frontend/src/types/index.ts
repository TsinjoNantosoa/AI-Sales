export type UserRole = "ADMIN" | "SALES_MANAGER" | "SALES_REPRESENTATIVE";

export type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "QUALIFYING"
  | "QUALIFIED"
  | "MEETING_SCHEDULED"
  | "PROPOSAL_SENT"
  | "NEGOTIATION"
  | "WON"
  | "LOST"
  | "INACTIVE";

export type LeadTemperature = "COLD" | "WARM" | "HOT";
export type LeadSource = "Website" | "Chatbot" | "Email" | "Referral" | "LinkedIn" | "Manual" | "Other";

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  phone?: string;
  country: string;
  language: string;
  source: LeadSource;
  serviceInterest: string;
  budgetMin?: number;
  budgetMax?: number;
  timeline?: string;
  needDescription: string;
  estimatedValue?: number;
  score: number;
  temperature: LeadTemperature;
  status: LeadStatus;
  assignedUserId?: string;
  lastInteractionAt?: string;
  nextFollowUpAt?: string;
  consentGiven: boolean;
  tags: string[];
  priority: "Low" | "Medium" | "High" | "Urgent";
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: UserRole;
  status: "active" | "inactive";
  avatar?: string;
  language: string;
  timezone: string;
  assignedLeads: number;
  activeOpportunities: number;
  meetings: number;
  conversionRate: number;
  lastActive: string;
  calendarConnected: boolean;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  sender: "user" | "ai" | "agent";
  senderName?: string;
  timestamp: string;
  read: boolean;
  attachments?: string[];
}

export interface Conversation {
  id: string;
  leadId: string;
  leadName: string;
  leadCompany: string;
  leadEmail: string;
  channel: "chatbot" | "email" | "phone" | "whatsapp";
  status: "open" | "waiting" | "assigned" | "ai_handled" | "human_handoff" | "closed";
  assignedUserId?: string;
  messages: Message[];
  unreadCount: number;
  lastMessage: string;
  lastMessageAt: string;
  humanHandoffRequested: boolean;
  summary?: string;
  createdAt: string;
}

export type AppointmentStatus = "Proposed" | "Confirmed" | "Completed" | "Cancelled" | "No Show";
export type AppointmentType = "15-minute introduction" | "30-minute discovery call" | "60-minute technical consultation";

export interface Appointment {
  id: string;
  leadId: string;
  leadName: string;
  leadCompany: string;
  leadEmail: string;
  assignedUserId: string;
  salespersonName: string;
  date: string;
  time: string;
  duration: number;
  timezone: string;
  type: AppointmentType;
  status: AppointmentStatus;
  meetingLink?: string;
  notes?: string;
  googleMeet: boolean;
  createdAt: string;
}

export type TaskPriority = "Low" | "Medium" | "High" | "Urgent";
export type TaskStatus = "To Do" | "In Progress" | "Completed" | "Cancelled";

export interface Task {
  id: string;
  title: string;
  description?: string;
  leadId?: string;
  leadName?: string;
  assignedUserId: string;
  assignedUserName: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
  completedAt?: string;
  createdAt: string;
}

export type NotificationCategory = "leads" | "meetings" | "tasks" | "automations" | "system";

export interface Notification {
  id: string;
  title: string;
  message: string;
  category: NotificationCategory;
  read: boolean;
  relatedId?: string;
  relatedType?: string;
  createdAt: string;
}

export type WorkflowStatus = "active" | "inactive";
export type ExecutionStatus = "Success" | "Running" | "Failed" | "Retrying" | "Waiting";

export interface Workflow {
  id: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  lastExecution?: string;
  successRate: number;
  totalExecutions: number;
  avgDuration: string;
  errors: number;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: ExecutionStatus;
  startedAt: string;
  duration: string;
  retryCount: number;
  relatedLeadId?: string;
  relatedLeadName?: string;
  errorMessage?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  entity: string;
  entityId: string;
  ip: string;
  result: "success" | "failure";
  details: string;
}

export interface LeadScoreBreakdown {
  budgetFit: number;
  urgency: number;
  serviceFit: number;
  decisionAuthority: number;
  companySize: number;
  profileCompleteness: number;
  total: number;
}

export interface Activity {
  id: string;
  leadId: string;
  leadName: string;
  type: "created" | "updated" | "message" | "email" | "scored" | "assigned" | "task" | "appointment" | "status_changed" | "note";
  description: string;
  userId?: string;
  userName?: string;
  createdAt: string;
}

export interface EmailLog {
  id: string;
  leadId: string;
  subject: string;
  recipient: string;
  status: "sent" | "delivered" | "opened" | "failed";
  template: string;
  sentAt: string;
}

export interface Integration {
  id: string;
  name: string;
  description: string;
  logo: string;
  status: "connected" | "available" | "coming_soon";
  lastSync?: string;
  category: string;
}

export interface Note {
  id: string;
  leadId: string;
  content: string;
  userId: string;
  userName: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardOverview {
  totalLeads: number;
  newLeads: number;
  qualifiedLeads: number;
  hotLeads: number;
  meetingsBooked: number;
  conversionRate: number;
  pipelineValue: number;
  averageResponseTimeSeconds: number;
  avgResponseTime: string;
  changes: {
    totalLeads: number;
    newLeads: number;
    qualifiedLeads: number;
    hotLeads: number;
    meetingsBooked: number;
    conversionRate: number;
    pipelineValue: number;
  };
}

export interface LeadTrendPoint {
  date: string;
  leads: number;
  qualified: number;
  value?: number;
}

export interface PipelineMetric {
  status: LeadStatus;
  label: string;
  count: number;
  value: number;
}

export interface SourceMetric {
  source: string;
  count: number;
  qualificationRate: number;
  conversionRate: number;
  pipelineValue: number;
}

export interface TeamPerformanceMetric {
  userId: string;
  name: string;
  assignedLeads: number;
  qualifiedLeads: number;
  meetings: number;
  wins: number;
  conversionRate: number;
  revenue: number;
}

export interface AutomationPerformanceMetric {
  workflowId: string;
  workflowName: string;
  executions: number;
  successRate: number;
  averageDurationMs: number;
  failedExecutions: number;
  recoveredExecutions: number;
}

export interface AnalyticsData {
  leadTrend: LeadTrendPoint[];
  funnel: PipelineMetric[];
  sources: SourceMetric[];
  teamPerformance: TeamPerformanceMetric[];
  automationPerformance: AutomationPerformanceMetric[];
  avgTimeByStage?: { stage: string; days: number }[];
  aiPerformance?: {
    conversationsHandled: number;
    qualificationRate: number;
    avgScore: number;
    humanHandoffRate: number;
    appointmentRate: number;
  };
}

export type IntegrationStatus =
  | "CONNECTED"
  | "DISCONNECTED"
  | "CONNECTING"
  | "ERROR"
  | "connected"
  | "available"
  | "coming_soon";

export interface AppSettings {
  general: {
    companyName: string;
    timezone: string;
    defaultLanguage: string;
    currency: string;
    dateFormat: string;
  };
  leadManagement: {
    autoAssign: boolean;
    defaultAssigneeId: string;
    duplicateDetection: boolean;
    archiveAfterDays: number;
  };
  leadScoring: {
    hotThreshold: number;
    warmThreshold: number;
    autoQualifyAt: number;
  };
  aiAssistant: {
    enabled: boolean;
    name: string;
    tone: string;
    handoffThreshold: number;
  };
  followUps: {
    enabled: boolean;
    firstFollowUpHours: number;
    maxAttempts: number;
  };
  emailTemplates: {
    welcomeSubject: string;
    meetingSubject: string;
    followUpSubject: string;
  };
  notifications: {
    emailEnabled: boolean;
    inAppEnabled: boolean;
    hotLeadAlerts: boolean;
    meetingReminders: boolean;
  };
  security: {
    sessionTimeoutMinutes: number;
    requireMfa: boolean;
    passwordMinLength: number;
  };
  availability: {
    timezone: string;
    bufferMinutes: number;
    days: Array<{
      day: string;
      enabled: boolean;
      start: string;
      end: string;
    }>;
  };
}

export type Settings = AppSettings;

export interface PipelineStage {
  status: LeadStatus;
  count: number;
  value: number;
}

export interface SourceData {
  source: string;
  count: number;
  percentage: number;
}

export interface TimeSeriesData {
  date: string;
  value: number;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatar?: string;
  timezone: string;
  language: string;
}
