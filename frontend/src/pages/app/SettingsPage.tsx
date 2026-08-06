import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { PageLoader } from "@/components/common/LoadingSpinner";
import { settingsService } from "@/services/settingsService";
import { queryKeys } from "@/lib/queryKeys";
import type { Settings } from "@/types";
import { toast } from "sonner";

const EMAIL_TEMPLATES = [
  { id: "welcome", name: "Welcome Email", subject: "Welcome to AI Sales Assistant — Your Demo Request" },
  { id: "qualification", name: "Qualification Follow-up", subject: "Following up on your request" },
  { id: "meeting_proposal", name: "Meeting Proposal", subject: "Let's schedule a call" },
  { id: "meeting_confirmation", name: "Meeting Confirmation", subject: "Your meeting is confirmed — {{meeting_date}}" },
  { id: "meeting_reminder", name: "Meeting Reminder", subject: "Reminder: Your call tomorrow at {{meeting_time}}" },
  { id: "no_response", name: "No Response Follow-up", subject: "Still interested in {{service_interest}}?" },
  { id: "hot_lead_alert", name: "Hot Lead Alert", subject: "🔥 New hot lead assigned to you" },
];

const TEMPLATE_BODY: Record<string, string> = {
  welcome: `Hello {{lead_first_name}},

Thank you for reaching out to us! We've received your request and our team will review it shortly.

In the meantime, our AI assistant Ava is available to answer any questions you may have.

Best regards,
{{salesperson_name}}`,
  meeting_confirmation: `Hello {{lead_first_name}},

Your meeting is confirmed!

Date: {{meeting_date}}
Time: {{meeting_time}}
Duration: 30 minutes
Meeting Link: {{meeting_link}}

Looking forward to speaking with you.

{{salesperson_name}}`,
};

type LocalExtras = {
  website: string;
  autoQualifyOnScore: boolean;
  scoringWeights: {
    budget: number;
    urgency: number;
    serviceFit: number;
    decisionAuthority: number;
    companySize: number;
    profileCompleteness: number;
  };
  welcomeMessage: string;
  confidenceThreshold: number;
  secondFollowUpDays: number;
  finalFollowUpDays: number;
  stopAfterReply: boolean;
  templateBodies: Record<string, string>;
  templateSubjects: Record<string, string>;
  notifPrefs: { label: string; email: boolean; inApp: boolean }[];
  loginAlerts: boolean;
  auditLogging: boolean;
  webhookValidation: boolean;
};

const DEFAULT_EXTRAS: LocalExtras = {
  website: "https://aisales.demo",
  autoQualifyOnScore: true,
  scoringWeights: {
    budget: 25, urgency: 20, serviceFit: 20, decisionAuthority: 10, companySize: 10, profileCompleteness: 15,
  },
  welcomeMessage: "Hello! I'm Ava, your AI Sales Assistant. How can I help you today?",
  confidenceThreshold: 0.75,
  secondFollowUpDays: 3,
  finalFollowUpDays: 7,
  stopAfterReply: true,
  templateBodies: { ...TEMPLATE_BODY },
  templateSubjects: Object.fromEntries(EMAIL_TEMPLATES.map((t) => [t.id, t.subject])),
  notifPrefs: [
    { label: "New Hot Lead", email: true, inApp: true },
    { label: "Meeting Confirmed", email: true, inApp: true },
    { label: "Meeting Reminder (1h before)", email: true, inApp: true },
    { label: "Workflow Failed", email: true, inApp: true },
    { label: "Task Overdue", email: false, inApp: true },
    { label: "Lead Assigned to Me", email: true, inApp: true },
    { label: "Human Handoff Requested", email: true, inApp: true },
  ],
  loginAlerts: false,
  auditLogging: true,
  webhookValidation: false,
};

export function SettingsPage() {
  const qc = useQueryClient();
  const [activeTemplate, setActiveTemplate] = useState("welcome");
  const [draft, setDraft] = useState<Settings | null>(null);
  const [extras, setExtras] = useState<LocalExtras>(DEFAULT_EXTRAS);

  const { data: settings, isLoading } = useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: () => settingsService.getSettings(),
  });

  useEffect(() => {
    if (!settings) return;
    setDraft({ ...settings });
    setExtras((prev) => ({
      ...prev,
      templateSubjects: {
        ...prev.templateSubjects,
        welcome: settings.emailTemplates.welcomeSubject || prev.templateSubjects.welcome,
        meeting_confirmation: settings.emailTemplates.meetingSubject || prev.templateSubjects.meeting_confirmation,
        no_response: settings.emailTemplates.followUpSubject || prev.templateSubjects.no_response,
      },
      notifPrefs: prev.notifPrefs.map((n) => {
        if (n.label === "New Hot Lead") {
          return { ...n, email: settings.notifications.hotLeadAlerts && settings.notifications.emailEnabled, inApp: settings.notifications.hotLeadAlerts && settings.notifications.inAppEnabled };
        }
        if (n.label.startsWith("Meeting Reminder")) {
          return { ...n, email: settings.notifications.meetingReminders && settings.notifications.emailEnabled, inApp: settings.notifications.meetingReminders && settings.notifications.inAppEnabled };
        }
        return {
          ...n,
          email: n.email && settings.notifications.emailEnabled,
          inApp: n.inApp && settings.notifications.inAppEnabled,
        };
      }),
    }));
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: ({ patch }: { section: string; patch: Partial<Settings> }) =>
      settingsService.updateSettings(patch),
    onSuccess: (updated, { section }) => {
      qc.setQueryData(queryKeys.settings.all, updated);
      setDraft(updated);
      toast.success(`${section} settings saved.`);
    },
    onError: () => toast.error("Failed to save settings."),
  });

  if (isLoading || !draft) return <PageLoader />;

  const save = (section: string, patch: Partial<Settings>) => {
    saveMutation.mutate({ section, patch });
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure your AI Sales Assistant platform</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
          {["general","lead-management","lead-scoring","ai","follow-ups","templates","notifications","security"].map((tab) => (
            <TabsTrigger key={tab} value={tab} className="capitalize text-xs">{tab.replace("-", " ")}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="general">
          <div className="max-w-xl space-y-4">
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h3 className="font-semibold">Company Information</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Company Name</Label>
                  <Input
                    value={draft.general.companyName}
                    onChange={(e) => setDraft({ ...draft, general: { ...draft.general, companyName: e.target.value } })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Website</Label>
                  <Input
                    value={extras.website}
                    onChange={(e) => setExtras({ ...extras, website: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Default Language</Label>
                  <Select
                    value={draft.general.defaultLanguage}
                    onValueChange={(v) => setDraft({ ...draft, general: { ...draft.general, defaultLanguage: v } })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="fr">French</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Select
                    value={draft.general.currency}
                    onValueChange={(v) => setDraft({ ...draft, general: { ...draft.general, currency: v } })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["USD","EUR","GBP","CAD"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Timezone</Label>
                <Select
                  value={draft.general.timezone}
                  onValueChange={(v) => setDraft({ ...draft, general: { ...draft.general, timezone: v } })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["America/New_York","America/Chicago","America/Los_Angeles","Europe/London","Europe/Paris","Asia/Tokyo"].map((tz) => (
                      <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              disabled={saveMutation.isPending}
              onClick={() => save("General", { general: draft.general })}
            >
              Save Changes
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="lead-management">
          <div className="max-w-xl space-y-4">
            <div className="bg-card border border-border rounded-xl p-5 space-y-5">
              <h3 className="font-semibold">Lead Management</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Duplicate Detection</p>
                    <p className="text-xs text-muted-foreground">Automatically detect and merge duplicate leads</p>
                  </div>
                  <Switch
                    checked={draft.leadManagement.duplicateDetection}
                    onCheckedChange={(v) => setDraft({ ...draft, leadManagement: { ...draft.leadManagement, duplicateDetection: v } })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Automatic Assignment</p>
                    <p className="text-xs text-muted-foreground">Round-robin assignment to available sales reps</p>
                  </div>
                  <Switch
                    checked={draft.leadManagement.autoAssign}
                    onCheckedChange={(v) => setDraft({ ...draft, leadManagement: { ...draft.leadManagement, autoAssign: v } })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Auto-qualify on Score</p>
                    <p className="text-xs text-muted-foreground">Automatically move leads to QUALIFIED when score &gt;= 60</p>
                  </div>
                  <Switch
                    checked={extras.autoQualifyOnScore}
                    onCheckedChange={(v) => setExtras({ ...extras, autoQualifyOnScore: v })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Lead Inactivity Delay (days)</Label>
                <Input
                  type="number"
                  value={draft.leadManagement.archiveAfterDays}
                  onChange={(e) => setDraft({
                    ...draft,
                    leadManagement: { ...draft.leadManagement, archiveAfterDays: Number(e.target.value) || 0 },
                  })}
                  className="max-w-[100px]"
                />
                <p className="text-xs text-muted-foreground">Mark leads as INACTIVE after this many days without activity.</p>
              </div>
            </div>
            <Button
              disabled={saveMutation.isPending}
              onClick={() => save("Lead Management", { leadManagement: draft.leadManagement })}
            >
              Save Changes
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="lead-scoring">
          <div className="max-w-xl space-y-4">
            <div className="bg-card border border-border rounded-xl p-5 space-y-5">
              <h3 className="font-semibold">Scoring Criteria</h3>
              <p className="text-sm text-muted-foreground">Adjust the maximum points for each scoring criterion. Total should add up to 100.</p>
              {Object.entries(extras.scoringWeights).map(([key, value]) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</Label>
                    <span className="text-sm font-bold text-primary">{value} pts</span>
                  </div>
                  <Slider
                    value={[value]}
                    min={0}
                    max={30}
                    step={5}
                    onValueChange={([v]) => setExtras({
                      ...extras,
                      scoringWeights: { ...extras.scoringWeights, [key]: v },
                    })}
                    className="w-full"
                  />
                </div>
              ))}
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm">
                  Total: <strong className={Object.values(extras.scoringWeights).reduce((s, v) => s + v, 0) === 100 ? "text-green-600" : "text-red-600"}>
                    {Object.values(extras.scoringWeights).reduce((s, v) => s + v, 0)} / 100
                  </strong>
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
                <div className="space-y-1.5">
                  <Label>Hot threshold</Label>
                  <Input
                    type="number"
                    value={draft.leadScoring.hotThreshold}
                    onChange={(e) => setDraft({
                      ...draft,
                      leadScoring: { ...draft.leadScoring, hotThreshold: Number(e.target.value) || 0 },
                    })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Warm threshold</Label>
                  <Input
                    type="number"
                    value={draft.leadScoring.warmThreshold}
                    onChange={(e) => setDraft({
                      ...draft,
                      leadScoring: { ...draft.leadScoring, warmThreshold: Number(e.target.value) || 0 },
                    })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Auto-qualify at</Label>
                  <Input
                    type="number"
                    value={draft.leadScoring.autoQualifyAt}
                    onChange={(e) => setDraft({
                      ...draft,
                      leadScoring: { ...draft.leadScoring, autoQualifyAt: Number(e.target.value) || 0 },
                    })}
                  />
                </div>
              </div>
            </div>
            <Button
              disabled={saveMutation.isPending}
              onClick={() => save("Lead Scoring", { leadScoring: draft.leadScoring })}
            >
              Save Scoring Rules
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="ai">
          <div className="max-w-xl space-y-4">
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h3 className="font-semibold">AI Assistant Configuration</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Assistant Name</Label>
                  <Input
                    value={draft.aiAssistant.name}
                    onChange={(e) => setDraft({ ...draft, aiAssistant: { ...draft.aiAssistant, name: e.target.value } })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Tone</Label>
                  <Select
                    value={draft.aiAssistant.tone}
                    onValueChange={(v) => setDraft({ ...draft, aiAssistant: { ...draft.aiAssistant, tone: v } })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["professional","friendly","formal","casual"].map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Welcome Message</Label>
                <Textarea
                  value={extras.welcomeMessage}
                  onChange={(e) => setExtras({ ...extras, welcomeMessage: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Confidence Threshold</Label>
                    <span className="text-sm font-bold text-primary">{(extras.confidenceThreshold * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    value={[extras.confidenceThreshold * 100]}
                    min={50}
                    max={95}
                    step={5}
                    onValueChange={([v]) => setExtras({ ...extras, confidenceThreshold: v / 100 })}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Human Handoff Threshold (messages)</Label>
                    <span className="text-sm font-bold text-primary">{draft.aiAssistant.handoffThreshold}</span>
                  </div>
                  <Slider
                    value={[draft.aiAssistant.handoffThreshold]}
                    min={1}
                    max={10}
                    step={1}
                    onValueChange={([v]) => setDraft({ ...draft, aiAssistant: { ...draft.aiAssistant, handoffThreshold: v } })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Automatic Reply</p>
                  <p className="text-xs text-muted-foreground">AI responds automatically to new messages</p>
                </div>
                <Switch
                  checked={draft.aiAssistant.enabled}
                  onCheckedChange={(v) => setDraft({ ...draft, aiAssistant: { ...draft.aiAssistant, enabled: v } })}
                />
              </div>
            </div>
            <Button
              disabled={saveMutation.isPending}
              onClick={() => save("AI Assistant", { aiAssistant: draft.aiAssistant })}
            >
              Save Changes
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="follow-ups">
          <div className="max-w-xl space-y-4">
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h3 className="font-semibold">Follow-up Configuration</h3>
              <div className="flex items-center justify-between">
                <Label>First Follow-up Delay</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={Math.max(1, Math.round(draft.followUps.firstFollowUpHours / 24))}
                    onChange={(e) => setDraft({
                      ...draft,
                      followUps: {
                        ...draft.followUps,
                        firstFollowUpHours: (Number(e.target.value) || 1) * 24,
                      },
                    })}
                    className="w-16 h-8 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">day</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Second Follow-up Delay</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={extras.secondFollowUpDays}
                    onChange={(e) => setExtras({ ...extras, secondFollowUpDays: Number(e.target.value) || 0 })}
                    className="w-16 h-8 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">days</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Final Follow-up Delay</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={extras.finalFollowUpDays}
                    onChange={(e) => setExtras({ ...extras, finalFollowUpDays: Number(e.target.value) || 0 })}
                    className="w-16 h-8 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">days</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Maximum Attempts</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={draft.followUps.maxAttempts}
                    onChange={(e) => setDraft({
                      ...draft,
                      followUps: { ...draft.followUps, maxAttempts: Number(e.target.value) || 0 },
                    })}
                    className="w-16 h-8 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">attempts</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Stop After Reply</p>
                  <p className="text-xs text-muted-foreground">Stop follow-up sequence when lead replies</p>
                </div>
                <Switch
                  checked={extras.stopAfterReply}
                  onCheckedChange={(v) => setExtras({ ...extras, stopAfterReply: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Follow-ups Enabled</p>
                  <p className="text-xs text-muted-foreground">Enable automated follow-up sequences</p>
                </div>
                <Switch
                  checked={draft.followUps.enabled}
                  onCheckedChange={(v) => setDraft({ ...draft, followUps: { ...draft.followUps, enabled: v } })}
                />
              </div>
            </div>
            <Button
              disabled={saveMutation.isPending}
              onClick={() => save("Follow-ups", { followUps: draft.followUps })}
            >
              Save Changes
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="templates">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              {EMAIL_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTemplate(t.id)}
                  className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${activeTemplate === t.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
                >
                  <p className="font-medium truncate">{t.name}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {extras.templateSubjects[t.id] ?? t.subject}
                  </p>
                </button>
              ))}
            </div>
            <div className="md:col-span-2 space-y-3">
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <Input
                  value={extras.templateSubjects[activeTemplate] ?? ""}
                  onChange={(e) => setExtras({
                    ...extras,
                    templateSubjects: { ...extras.templateSubjects, [activeTemplate]: e.target.value },
                  })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Body</Label>
                <Textarea
                  value={extras.templateBodies[activeTemplate] ?? "Email template body..."}
                  onChange={(e) => setExtras({
                    ...extras,
                    templateBodies: { ...extras.templateBodies, [activeTemplate]: e.target.value },
                  })}
                  rows={10}
                  className="font-mono text-sm"
                />
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs font-medium text-muted-foreground mb-2">Available Variables</p>
                <div className="flex flex-wrap gap-1.5">
                  {["{{lead_first_name}}","{{lead_last_name}}","{{company_name}}","{{salesperson_name}}","{{meeting_date}}","{{meeting_time}}","{{meeting_link}}","{{service_interest}}"].map((v) => (
                    <code key={v} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-primary">{v}</code>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => toast.info("Preview opened")}>Preview</Button>
                <Button
                  disabled={saveMutation.isPending}
                  onClick={() => save("Email Templates", {
                    emailTemplates: {
                      welcomeSubject: extras.templateSubjects.welcome ?? draft.emailTemplates.welcomeSubject,
                      meetingSubject: extras.templateSubjects.meeting_confirmation ?? draft.emailTemplates.meetingSubject,
                      followUpSubject: extras.templateSubjects.no_response ?? draft.emailTemplates.followUpSubject,
                    },
                  })}
                >
                  Save Template
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <div className="max-w-xl space-y-4">
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h3 className="font-semibold">Notification Preferences</h3>
              {extras.notifPrefs.map((n, idx) => (
                <div key={n.label} className="flex items-center justify-between">
                  <p className="text-sm">{n.label}</p>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <Switch
                        checked={n.email}
                        onCheckedChange={(v) => {
                          const next = [...extras.notifPrefs];
                          next[idx] = { ...n, email: v };
                          setExtras({ ...extras, notifPrefs: next });
                        }}
                      />
                      <span className="text-xs text-muted-foreground">Email</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Switch
                        checked={n.inApp}
                        onCheckedChange={(v) => {
                          const next = [...extras.notifPrefs];
                          next[idx] = { ...n, inApp: v };
                          setExtras({ ...extras, notifPrefs: next });
                        }}
                      />
                      <span className="text-xs text-muted-foreground">In-app</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Button
              disabled={saveMutation.isPending}
              onClick={() => {
                const hot = extras.notifPrefs.find((n) => n.label === "New Hot Lead");
                const meeting = extras.notifPrefs.find((n) => n.label.startsWith("Meeting Reminder"));
                save("Notifications", {
                  notifications: {
                    emailEnabled: extras.notifPrefs.some((n) => n.email),
                    inAppEnabled: extras.notifPrefs.some((n) => n.inApp),
                    hotLeadAlerts: !!(hot?.email || hot?.inApp),
                    meetingReminders: !!(meeting?.email || meeting?.inApp),
                  },
                });
              }}
            >
              Save Preferences
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="security">
          <div className="max-w-xl space-y-4">
            <div className="bg-card border border-border rounded-xl p-5 space-y-5">
              <h3 className="font-semibold">Security Settings</h3>
              <div className="space-y-1.5">
                <Label>Session Timeout (minutes)</Label>
                <Input
                  type="number"
                  value={draft.security.sessionTimeoutMinutes}
                  onChange={(e) => setDraft({
                    ...draft,
                    security: { ...draft.security, sessionTimeoutMinutes: Number(e.target.value) || 0 },
                  })}
                  className="max-w-[120px]"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Two-Factor Authentication</p>
                  <p className="text-xs text-muted-foreground">Require 2FA for all team members</p>
                </div>
                <Switch
                  checked={draft.security.requireMfa}
                  onCheckedChange={(v) => setDraft({ ...draft, security: { ...draft.security, requireMfa: v } })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Login Alerts</p>
                  <p className="text-xs text-muted-foreground">Email alerts on new login from unknown devices</p>
                </div>
                <Switch
                  checked={extras.loginAlerts}
                  onCheckedChange={(v) => setExtras({ ...extras, loginAlerts: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Audit Logging</p>
                  <p className="text-xs text-muted-foreground">Log all user actions for compliance</p>
                </div>
                <Switch
                  checked={extras.auditLogging}
                  onCheckedChange={(v) => setExtras({ ...extras, auditLogging: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Webhook Signature Validation</p>
                  <p className="text-xs text-muted-foreground">Validate webhook payloads from n8n</p>
                </div>
                <Switch
                  checked={extras.webhookValidation}
                  onCheckedChange={(v) => setExtras({ ...extras, webhookValidation: v })}
                />
              </div>
            </div>
            <Button
              disabled={saveMutation.isPending}
              onClick={() => save("Security", { security: draft.security })}
            >
              Save Settings
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
