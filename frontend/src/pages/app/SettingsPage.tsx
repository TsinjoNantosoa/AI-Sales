import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
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

export function SettingsPage() {
  const [activeTemplate, setActiveTemplate] = useState("welcome");
  const [generalSettings, setGeneralSettings] = useState({
    companyName: "AI Sales Assistant", website: "https://aisales.demo",
    language: "en", timezone: "America/New_York", currency: "USD", dateFormat: "MMM d, yyyy",
  });
  const [scoringWeights, setScoringWeights] = useState({
    budget: 25, urgency: 20, serviceFit: 20, decisionAuthority: 10, companySize: 10, profileCompleteness: 15,
  });
  const [aiSettings, setAiSettings] = useState({
    assistantName: "Ava", welcomeMessage: "Hello! I'm Ava, your AI Sales Assistant. How can I help you today?",
    tone: "professional", confidenceThreshold: 0.75, autoReply: true, humanHandoffThreshold: 3,
  });

  const save = (section: string) => toast.success(`${section} settings saved.`);

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
                <div className="space-y-1.5"><Label>Company Name</Label><Input value={generalSettings.companyName} onChange={(e) => setGeneralSettings({ ...generalSettings, companyName: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Website</Label><Input value={generalSettings.website} onChange={(e) => setGeneralSettings({ ...generalSettings, website: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Default Language</Label>
                  <Select value={generalSettings.language} onValueChange={(v) => setGeneralSettings({ ...generalSettings, language: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="fr">French</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Select value={generalSettings.currency} onValueChange={(v) => setGeneralSettings({ ...generalSettings, currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["USD","EUR","GBP","CAD"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Timezone</Label>
                <Select value={generalSettings.timezone} onValueChange={(v) => setGeneralSettings({ ...generalSettings, timezone: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["America/New_York","America/Chicago","America/Los_Angeles","Europe/London","Europe/Paris","Asia/Tokyo"].map((tz) => (
                      <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={() => save("General")}>Save Changes</Button>
          </div>
        </TabsContent>

        <TabsContent value="lead-management">
          <div className="max-w-xl space-y-4">
            <div className="bg-card border border-border rounded-xl p-5 space-y-5">
              <h3 className="font-semibold">Lead Management</h3>
              <div className="space-y-4">
                {[
                  { label: "Duplicate Detection", desc: "Automatically detect and merge duplicate leads" },
                  { label: "Automatic Assignment", desc: "Round-robin assignment to available sales reps" },
                  { label: "Auto-qualify on Score", desc: "Automatically move leads to QUALIFIED when score >= 60" },
                ].map((setting) => (
                  <div key={setting.label} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{setting.label}</p>
                      <p className="text-xs text-muted-foreground">{setting.desc}</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label>Lead Inactivity Delay (days)</Label>
                <Input type="number" defaultValue={30} className="max-w-[100px]" />
                <p className="text-xs text-muted-foreground">Mark leads as INACTIVE after this many days without activity.</p>
              </div>
            </div>
            <Button onClick={() => save("Lead Management")}>Save Changes</Button>
          </div>
        </TabsContent>

        <TabsContent value="lead-scoring">
          <div className="max-w-xl space-y-4">
            <div className="bg-card border border-border rounded-xl p-5 space-y-5">
              <h3 className="font-semibold">Scoring Criteria</h3>
              <p className="text-sm text-muted-foreground">Adjust the maximum points for each scoring criterion. Total should add up to 100.</p>
              {Object.entries(scoringWeights).map(([key, value]) => (
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
                    onValueChange={([v]) => setScoringWeights({ ...scoringWeights, [key]: v })}
                    className="w-full"
                  />
                </div>
              ))}
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm">
                  Total: <strong className={Object.values(scoringWeights).reduce((s, v) => s + v, 0) === 100 ? "text-green-600" : "text-red-600"}>
                    {Object.values(scoringWeights).reduce((s, v) => s + v, 0)} / 100
                  </strong>
                </p>
              </div>
            </div>
            <Button onClick={() => save("Lead Scoring")}>Save Scoring Rules</Button>
          </div>
        </TabsContent>

        <TabsContent value="ai">
          <div className="max-w-xl space-y-4">
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h3 className="font-semibold">AI Assistant Configuration</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Assistant Name</Label><Input value={aiSettings.assistantName} onChange={(e) => setAiSettings({ ...aiSettings, assistantName: e.target.value })} /></div>
                <div className="space-y-1.5">
                  <Label>Tone</Label>
                  <Select value={aiSettings.tone} onValueChange={(v) => setAiSettings({ ...aiSettings, tone: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["professional","friendly","formal","casual"].map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Welcome Message</Label>
                <Textarea value={aiSettings.welcomeMessage} onChange={(e) => setAiSettings({ ...aiSettings, welcomeMessage: e.target.value })} rows={3} />
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Confidence Threshold</Label>
                    <span className="text-sm font-bold text-primary">{(aiSettings.confidenceThreshold * 100).toFixed(0)}%</span>
                  </div>
                  <Slider value={[aiSettings.confidenceThreshold * 100]} min={50} max={95} step={5} onValueChange={([v]) => setAiSettings({ ...aiSettings, confidenceThreshold: v / 100 })} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Human Handoff Threshold (messages)</Label>
                    <span className="text-sm font-bold text-primary">{aiSettings.humanHandoffThreshold}</span>
                  </div>
                  <Slider value={[aiSettings.humanHandoffThreshold]} min={1} max={10} step={1} onValueChange={([v]) => setAiSettings({ ...aiSettings, humanHandoffThreshold: v })} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Automatic Reply</p>
                  <p className="text-xs text-muted-foreground">AI responds automatically to new messages</p>
                </div>
                <Switch checked={aiSettings.autoReply} onCheckedChange={(v) => setAiSettings({ ...aiSettings, autoReply: v })} />
              </div>
            </div>
            <Button onClick={() => save("AI Assistant")}>Save Changes</Button>
          </div>
        </TabsContent>

        <TabsContent value="follow-ups">
          <div className="max-w-xl space-y-4">
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h3 className="font-semibold">Follow-up Configuration</h3>
              {[
                { label: "First Follow-up Delay", defaultValue: 1, unit: "day" },
                { label: "Second Follow-up Delay", defaultValue: 3, unit: "days" },
                { label: "Final Follow-up Delay", defaultValue: 7, unit: "days" },
                { label: "Maximum Attempts", defaultValue: 3, unit: "attempts" },
              ].map((f) => (
                <div key={f.label} className="flex items-center justify-between">
                  <Label>{f.label}</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" defaultValue={f.defaultValue} className="w-16 h-8 text-sm" />
                    <span className="text-xs text-muted-foreground">{f.unit}</span>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Stop After Reply</p>
                  <p className="text-xs text-muted-foreground">Stop follow-up sequence when lead replies</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
            <Button onClick={() => save("Follow-ups")}>Save Changes</Button>
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
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{t.subject}</p>
                </button>
              ))}
            </div>
            <div className="md:col-span-2 space-y-3">
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <Input defaultValue={EMAIL_TEMPLATES.find((t) => t.id === activeTemplate)?.subject} />
              </div>
              <div className="space-y-1.5">
                <Label>Body</Label>
                <Textarea defaultValue={TEMPLATE_BODY[activeTemplate] ?? "Email template body..."} rows={10} className="font-mono text-sm" />
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
                <Button onClick={() => save("Email Templates")}>Save Template</Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <div className="max-w-xl space-y-4">
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h3 className="font-semibold">Notification Preferences</h3>
              {[
                { label: "New Hot Lead", email: true, inApp: true },
                { label: "Meeting Confirmed", email: true, inApp: true },
                { label: "Meeting Reminder (1h before)", email: true, inApp: true },
                { label: "Workflow Failed", email: true, inApp: true },
                { label: "Task Overdue", email: false, inApp: true },
                { label: "Lead Assigned to Me", email: true, inApp: true },
                { label: "Human Handoff Requested", email: true, inApp: true },
              ].map((n) => (
                <div key={n.label} className="flex items-center justify-between">
                  <p className="text-sm">{n.label}</p>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5"><Switch defaultChecked={n.email} /><span className="text-xs text-muted-foreground">Email</span></div>
                    <div className="flex items-center gap-1.5"><Switch defaultChecked={n.inApp} /><span className="text-xs text-muted-foreground">In-app</span></div>
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={() => save("Notifications")}>Save Preferences</Button>
          </div>
        </TabsContent>

        <TabsContent value="security">
          <div className="max-w-xl space-y-4">
            <div className="bg-card border border-border rounded-xl p-5 space-y-5">
              <h3 className="font-semibold">Security Settings</h3>
              <div className="space-y-1.5">
                <Label>Session Timeout (minutes)</Label>
                <Input type="number" defaultValue={60} className="max-w-[120px]" />
              </div>
              {[
                { label: "Two-Factor Authentication", desc: "Require 2FA for all team members" },
                { label: "Login Alerts", desc: "Email alerts on new login from unknown devices" },
                { label: "Audit Logging", desc: "Log all user actions for compliance" },
                { label: "Webhook Signature Validation", desc: "Validate webhook payloads from n8n" },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{s.label}</p>
                    <p className="text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                  <Switch defaultChecked={s.label === "Audit Logging"} />
                </div>
              ))}
            </div>
            <Button onClick={() => save("Security")}>Save Settings</Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
