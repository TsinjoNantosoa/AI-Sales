import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Edit, Mail, Phone, Calendar, Flag,
  Tag, Building2, Globe, Gauge, Clock, Plus, Loader2, UserCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, TemperatureBadge, PriorityBadge } from "@/components/common/StatusBadge";
import { UserAvatar } from "@/components/common/Avatar";
import { PageLoader } from "@/components/common/LoadingSpinner";
import { LeadFormModal } from "@/components/leads/LeadFormModal";
import { leadService } from "@/services/leadService";
import { teamService } from "@/services/teamService";
import { dashboardService } from "@/services/dashboardService";
import { conversationService } from "@/services/conversationService";
import { appointmentService } from "@/services/appointmentService";
import { taskService } from "@/services/taskService";
import { automationService } from "@/services/automationService";
import { queryKeys } from "@/lib/queryKeys";
import { formatCurrency, formatDate, formatDateTime, timeAgo, cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/authStore";
import { Progress } from "@/components/ui/progress";
import { ErrorState } from "@/components/common/ErrorState";

export function LeadDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [editOpen, setEditOpen] = useState(false);
  const [noteText, setNoteText] = useState("");

  const { data: lead, isLoading, error: leadError } = useQuery({
    queryKey: queryKeys.leads.detail(id!),
    queryFn: () =>
      leadService.getLead(id!, {
        currentUserId: user?.id,
        role: user?.role,
      }),
    enabled: !!id,
    retry: false,
  });

  const { data: notes = [] } = useQuery({
    queryKey: queryKeys.leads.notes(id!),
    queryFn: () => leadService.getNotes(id!),
    enabled: !!id && !leadError,
  });

  const { data: users = [] } = useQuery({
    queryKey: queryKeys.team.all,
    queryFn: () => teamService.getUsers(),
  });

  const { data: activities = [] } = useQuery({
    queryKey: queryKeys.activities.byLead(id!),
    queryFn: () => dashboardService.getActivities(id!),
    enabled: !!id && !leadError,
  });

  const { data: allConversations = [] } = useQuery({
    queryKey: [...queryKeys.conversations.all, user?.id, user?.role],
    queryFn: () =>
      conversationService.getConversations({
        currentUserId: user?.id,
        role: user?.role,
      }),
    enabled: !!id && !leadError,
  });

  const { data: allAppointments = [] } = useQuery({
    queryKey: [...queryKeys.appointments.all, user?.id, user?.role],
    queryFn: () =>
      appointmentService.getAppointments({
        currentUserId: user?.id,
        role: user?.role,
      }),
    enabled: !!id && !leadError,
  });

  const { data: allTasks = [] } = useQuery({
    queryKey: [...queryKeys.tasks.all, user?.id, user?.role],
    queryFn: () =>
      taskService.getTasks({
        currentUserId: user?.id,
        role: user?.role,
      }),
    enabled: !!id && !leadError,
  });

  const { data: emails = [] } = useQuery({
    queryKey: ["leads", "emails", id],
    queryFn: () => leadService.getEmailLogs(id!),
    enabled: !!id && !leadError,
  });

  const { data: workflowRuns = [] } = useQuery({
    queryKey: [...queryKeys.automations.executions, id],
    queryFn: () => automationService.getExecutions(id!),
    enabled: !!id && !leadError,
  });

  const addNoteMutation = useMutation({
    mutationFn: (content: string) => leadService.addNote(id!, content, user?.id ?? "u1", user ? `${user.firstName} ${user.lastName}` : "Admin"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.leads.notes(id!) });
      setNoteText("");
      toast.success("Note added successfully.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof leadService.updateLead>[1]) => leadService.updateLead(id!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.leads.detail(id!) });
      qc.invalidateQueries({ queryKey: queryKeys.leads.all });
      toast.success("Lead updated.");
    },
  });

  if (isLoading) return <PageLoader />;

  if (leadError || !lead) {
    const forbidden = leadError instanceof Error && leadError.message === "Forbidden";
    return (
      <ErrorState
        kind={forbidden ? "permission" : "notFound"}
        title={forbidden ? "Access denied" : "Lead not found"}
        description={
          forbidden
            ? "You can only view leads assigned to you."
            : "This lead does not exist or was removed."
        }
        action={{ label: "Back to leads", onClick: () => navigate("/app/leads") }}
      />
    );
  }

  const assignedUser = users.find((u) => u.id === lead.assignedUserId);
  const conversations = allConversations.filter((c) => c.leadId === lead.id);
  const appointments = allAppointments.filter((a) => a.leadId === lead.id);
  const tasks = allTasks.filter((t) => t.leadId === lead.id);

  const scoreBreakdown = [
    { label: "Budget Fit", points: Math.round(lead.score * 0.29), max: 25, color: "bg-blue-500" },
    { label: "Urgency", points: Math.round(lead.score * 0.23), max: 20, color: "bg-purple-500" },
    { label: "Service Fit", points: Math.round(lead.score * 0.23), max: 20, color: "bg-green-500" },
    { label: "Decision Authority", points: Math.round(lead.score * 0.12), max: 10, color: "bg-orange-500" },
    { label: "Profile Completeness", points: Math.round(lead.score * 0.13), max: 25, color: "bg-teal-500" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link to="/app/leads" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Leads
        </Link>
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <UserAvatar firstName={lead.firstName} lastName={lead.lastName} id={lead.id} size="lg" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">{lead.firstName} {lead.lastName}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{lead.companyName}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <StatusBadge status={lead.status} />
                <TemperatureBadge temp={lead.temperature} />
                <PriorityBadge priority={lead.priority} />
                <div className="flex items-center gap-1 bg-muted px-2 py-0.5 rounded-full">
                  <Gauge className="h-3 w-3 text-primary" aria-hidden="true" />
                  <span className="text-xs font-semibold text-primary">Score: {lead.score}/100</span>
                </div>
                {lead.source && (
                  <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full border border-border">
                    {lead.source}
                  </span>
                )}
              </div>
              {assignedUser && (
                <p className="text-xs text-muted-foreground mt-2">
                  Owner: {assignedUser.firstName} {assignedUser.lastName}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Next action:{" "}
                <span className="font-medium text-foreground">
                  {lead.temperature === "HOT" || lead.status === "QUALIFIED"
                    ? "Book a meeting"
                    : "Continue qualification"}
                </span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditOpen(true)}>
              <Edit className="h-4 w-4" /> Edit
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <Mail className="h-4 w-4" /> Send Email
            </Button>
            <Link to="/app/appointments">
              <Button variant="outline" size="sm" className="gap-2">
                <Calendar className="h-4 w-4" aria-hidden="true" /> Book Meeting
              </Button>
            </Link>
            <Button
              size="sm"
              className="gap-2 bg-green-600 hover:bg-green-700"
              onClick={() => updateMutation.mutate({ status: "WON" })}
            >
              <Flag className="h-4 w-4" /> Mark as Won
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Info Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {lead.email && (
          <div className="bg-card border border-border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1"><Mail className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs text-muted-foreground">Email</span></div>
            <p className="text-xs font-medium truncate">{lead.email}</p>
          </div>
        )}
        {lead.phone && (
          <div className="bg-card border border-border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1"><Phone className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs text-muted-foreground">Phone</span></div>
            <p className="text-xs font-medium">{lead.phone}</p>
          </div>
        )}
        <div className="bg-card border border-border rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1"><Globe className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs text-muted-foreground">Country</span></div>
          <p className="text-xs font-medium">{lead.country}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1"><Clock className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs text-muted-foreground">Created</span></div>
          <p className="text-xs font-medium">{formatDate(lead.createdAt)}</p>
        </div>
        {lead.estimatedValue && (
          <div className="bg-card border border-border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1"><Gauge className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs text-muted-foreground">Est. Value</span></div>
            <p className="text-xs font-bold text-green-600 dark:text-green-400">{formatCurrency(lead.estimatedValue)}</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="mb-4 flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="ai">AI Qualification</TabsTrigger>
          <TabsTrigger value="conversations">Conversations ({conversations.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity ({activities.length})</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
          <TabsTrigger value="appointments">Meetings ({appointments.length})</TabsTrigger>
          <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
          <TabsTrigger value="emails">Emails ({emails.length})</TabsTrigger>
          <TabsTrigger value="automation">Automation ({workflowRuns.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-4">
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold mb-4">Lead Information</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Source", lead.source],
                    ["Service", lead.serviceInterest],
                    ["Budget", lead.budgetMin && lead.budgetMax ? `$${lead.budgetMin.toLocaleString()} – $${lead.budgetMax.toLocaleString()}` : "—"],
                    ["Timeline", lead.timeline ?? "—"],
                    ["Language", lead.language === "fr" ? "French" : "English"],
                    ["Consent", lead.consentGiven ? "Given" : "Not given"],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <span className="text-muted-foreground text-xs">{k}</span>
                      <p className="font-medium">{v}</p>
                    </div>
                  ))}
                </div>
                {lead.needDescription && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <span className="text-xs text-muted-foreground">Need Description</span>
                    <p className="text-sm mt-1 leading-relaxed">{lead.needDescription}</p>
                  </div>
                )}
              </div>
              {lead.tags.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="font-semibold mb-3 flex items-center gap-2"><Tag className="h-4 w-4" />Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {lead.tags.map((tag) => (
                      <span key={tag} className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold mb-4">Assignment</h3>
                {assignedUser ? (
                  <div className="flex items-center gap-3">
                    <UserAvatar firstName={assignedUser.firstName} lastName={assignedUser.lastName} id={assignedUser.id} size="md" />
                    <div>
                      <p className="font-medium">{assignedUser.firstName} {assignedUser.lastName}</p>
                      <p className="text-xs text-muted-foreground">{assignedUser.role.replace("_", " ")}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No salesperson assigned</p>
                )}
              </div>
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold mb-3">Key Dates</h3>
                <div className="space-y-2 text-sm">
                  <div><span className="text-xs text-muted-foreground">Created</span><p className="font-medium">{formatDate(lead.createdAt)}</p></div>
                  {lead.lastInteractionAt && <div><span className="text-xs text-muted-foreground">Last Activity</span><p className="font-medium">{timeAgo(lead.lastInteractionAt)}</p></div>}
                  {lead.nextFollowUpAt && <div><span className="text-xs text-muted-foreground">Next Follow-up</span><p className="font-medium text-orange-600 dark:text-orange-400">{formatDate(lead.nextFollowUpAt)}</p></div>}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="ai">
          <div className="max-w-2xl space-y-4">
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold text-lg">Lead Score</h3>
                  <p className="text-sm text-muted-foreground">AI-calculated qualification score</p>
                </div>
                <div className="text-4xl font-bold text-foreground">{lead.score}<span className="text-lg text-muted-foreground">/100</span></div>
              </div>
              <Progress value={lead.score} className="h-3 mb-6" />
              <div className="space-y-4">
                {scoreBreakdown.map((c) => (
                  <div key={c.label}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{c.label}</span>
                      <span className="font-medium">+{c.points} / {c.max}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full", c.color)} style={{ width: `${(c.points / c.max) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><UserCheck className="h-4 w-4 text-primary" aria-hidden="true" />AI Recommendation</h3>
              <div className={cn("p-4 rounded-lg border", lead.score >= 70 ? "bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800" : "bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800")}>
                <p className="text-sm font-medium mb-1">Recommended Next Action</p>
                <p className="text-sm text-muted-foreground">
                  {lead.score >= 80
                    ? "Schedule a 30-minute discovery call within 24 hours. This is a hot lead with high conversion potential."
                    : lead.score >= 60
                    ? "Send a personalized follow-up email with case studies relevant to their industry."
                    : "Continue qualification via chatbot to gather missing information (budget, timeline, decision authority)."}
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="conversations">
          <div className="space-y-3">
            {conversations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No conversations yet.</div>
            ) : conversations.map((c) => (
              <Link key={c.id} to={`/app/conversations`} className="block bg-card border border-border rounded-xl p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded">{c.channel}</span>
                  <span className="text-xs text-muted-foreground">{timeAgo(c.lastMessageAt)}</span>
                </div>
                <p className="text-sm text-muted-foreground truncate">{c.lastMessage}</p>
                <p className="text-xs text-muted-foreground mt-1">{c.messages.length} messages</p>
              </Link>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="activity">
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
            <div className="space-y-4 pl-10">
              {activities.length === 0 ? (
                <p className="text-muted-foreground text-sm">No activity recorded yet.</p>
              ) : activities.map((a) => (
                <div key={a.id} className="relative">
                  <div className="absolute -left-6 top-1 h-4 w-4 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  </div>
                  <div className="bg-card border border-border rounded-lg p-3">
                    <p className="text-sm">{a.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {a.userName && <span className="text-xs text-muted-foreground">{a.userName}</span>}
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tasks">
          <div className="space-y-2">
            {tasks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No tasks linked to this lead.</div>
            ) : tasks.map((t) => (
              <div key={t.id} className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
                <div className={cn("h-3 w-3 rounded-full shrink-0", t.status === "Completed" ? "bg-green-500" : t.status === "In Progress" ? "bg-blue-500" : "bg-muted-foreground")} />
                <div className="flex-1">
                  <p className={cn("text-sm font-medium", t.status === "Completed" && "line-through text-muted-foreground")}>{t.title}</p>
                  <p className="text-xs text-muted-foreground">Due {formatDate(t.dueDate)}</p>
                </div>
                <PriorityBadge priority={t.priority} />
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="appointments">
          <div className="space-y-3">
            {appointments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No meetings scheduled.</div>
            ) : appointments.map((a) => (
              <div key={a.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                <div className="text-center bg-primary/10 rounded-lg p-3 min-w-[50px]">
                  <p className="text-lg font-bold text-primary">{a.date.slice(8)}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(a.date, "MMM")}</p>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{a.type}</p>
                  <p className="text-xs text-muted-foreground">{a.time} · {a.duration} min · {a.timezone}</p>
                  <p className="text-xs text-muted-foreground">With {a.salespersonName}</p>
                </div>
                <span className={cn("text-xs px-2 py-1 rounded-full font-medium",
                  a.status === "Confirmed" ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" :
                  a.status === "Completed" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400" :
                  "bg-muted text-muted-foreground"
                )}>{a.status}</span>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="notes">
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note..."
                rows={3}
                className="mb-3"
              />
              <Button
                size="sm"
                disabled={!noteText.trim() || addNoteMutation.isPending}
                onClick={() => addNoteMutation.mutate(noteText)}
              >
                {addNoteMutation.isPending ? <><Loader2 className="h-3 w-3 mr-2 animate-spin" />Adding...</> : <><Plus className="h-3 w-3 mr-2" />Add Note</>}
              </Button>
            </div>
            {notes.map((note) => (
              <div key={note.id} className="bg-card border border-border rounded-xl p-4">
                <p className="text-sm leading-relaxed mb-3">{note.content}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserAvatar firstName={note.userName.split(" ")[0]} lastName={note.userName.split(" ")[1] || ""} id={note.userId} size="xs" />
                    <span className="text-xs text-muted-foreground">{note.userName}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{timeAgo(note.createdAt)}</span>
                </div>
              </div>
            ))}
            {notes.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">No notes yet.</p>}
          </div>
        </TabsContent>

        <TabsContent value="emails">
          <div className="space-y-2">
            {emails.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No emails sent.</div>
            ) : emails.map((email) => (
              <div key={email.id} className="bg-card border border-border rounded-lg p-4 flex items-center gap-4">
                <Mail className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{email.subject}</p>
                  <p className="text-xs text-muted-foreground">{email.recipient} · Template: {email.template}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full",
                    email.status === "opened" ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" :
                    email.status === "delivered" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400" :
                    "bg-muted text-muted-foreground"
                  )}>{email.status}</span>
                  <span className="text-xs text-muted-foreground">{timeAgo(email.sentAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="automation">
          <div className="space-y-2">
            {workflowRuns.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No automation runs yet.</div>
            ) : workflowRuns.map((run) => (
              <div key={run.id} className="bg-card border border-border rounded-lg p-4 flex items-center gap-4">
                <div className={cn("h-3 w-3 rounded-full shrink-0",
                  run.status === "Success" ? "bg-green-500" :
                  run.status === "Failed" ? "bg-red-500" :
                  run.status === "Running" ? "bg-blue-500 animate-pulse" :
                  "bg-orange-500"
                )} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{run.workflowName}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(run.startedAt)} · {run.duration}</p>
                  {run.errorMessage && <p className="text-xs text-destructive mt-0.5">{run.errorMessage}</p>}
                </div>
                <div className="text-right">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                    run.status === "Success" ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" :
                    run.status === "Failed" ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400" :
                    "bg-muted text-muted-foreground"
                  )}>{run.status}</span>
                  {run.retryCount > 0 && <p className="text-[10px] text-muted-foreground mt-0.5">{run.retryCount} retries</p>}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <LeadFormModal open={editOpen} onOpenChange={setEditOpen} lead={lead} />
    </div>
  );
}
