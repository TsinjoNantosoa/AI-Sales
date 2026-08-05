import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, timeAgo } from "@/lib/utils";
import { toast } from "sonner";
import { Settings, Link2, Unlink, RefreshCw, ExternalLink } from "lucide-react";

const INTEGRATIONS = [
  {
    id: "n8n", name: "n8n", category: "Automation", description: "Workflow automation — triggers, webhooks, email sequences.",
    status: "connected", lastSync: "2024-01-15T11:30:00Z", icon: "⚡",
  },
  {
    id: "google-calendar", name: "Google Calendar", category: "Calendar", description: "Meeting scheduling and availability management.",
    status: "connected", lastSync: "2024-01-15T11:28:00Z", icon: "📅",
  },
  {
    id: "gmail", name: "Gmail", category: "Email", description: "Send automated emails from your Gmail account.",
    status: "connected", lastSync: "2024-01-15T11:00:00Z", icon: "📧",
  },
  {
    id: "hubspot", name: "HubSpot", category: "CRM", description: "Sync leads and contacts with HubSpot CRM.",
    status: "coming_soon", icon: "🔶",
  },
  {
    id: "odoo", name: "Odoo", category: "ERP", description: "Sync leads with Odoo ERP modules.",
    status: "coming_soon", icon: "🟣",
  },
  {
    id: "airtable", name: "Airtable", category: "Database", description: "Export and sync lead data with Airtable.",
    status: "coming_soon", icon: "📊",
  },
  {
    id: "slack", name: "Slack", category: "Messaging", description: "Get notifications in your Slack workspace.",
    status: "coming_soon", icon: "💬",
  },
  {
    id: "teams", name: "Microsoft Teams", category: "Messaging", description: "Get notifications in your Teams channels.",
    status: "available", icon: "🟦",
  },
  {
    id: "whatsapp", name: "WhatsApp Business", category: "Messaging", description: "Send messages via WhatsApp Business API.",
    status: "available", icon: "💚",
  },
  {
    id: "twilio", name: "Twilio", category: "SMS", description: "Send SMS notifications and alerts via Twilio.",
    status: "available", icon: "📱",
  },
  {
    id: "outlook", name: "Outlook Calendar", category: "Calendar", description: "Sync meetings with Microsoft Outlook Calendar.",
    status: "available", icon: "📆",
  },
];

type ConfigType = { n8n?: boolean; "google-calendar"?: boolean; gmail?: boolean };

export function IntegrationsPage() {
  const [configOpen, setConfigOpen] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState(INTEGRATIONS);
  const [n8nConfig, setN8nConfig] = useState({ webhookUrl: "https://n8n.company.com/webhook/aisales", apiUrl: "https://n8n.company.com", apiKey: "n8n_api_••••••••••••••", webhookSecret: "wh_secret_••••••••", errorWorkflow: true });
  const [gcalConfig, setGcalConfig] = useState({ calendar: "Primary Calendar", defaultDuration: "30", timezone: "America/New_York", googleMeet: true, syncEnabled: true });
  const [gmailConfig, setGmailConfig] = useState({ senderName: "AI Sales Assistant", senderEmail: "noreply@aisales.demo", replyTo: "sales@aisales.demo", signature: "Best regards,\nAI Sales Assistant Team", tracking: true });

  const disconnect = (id: string) => {
    setIntegrations((prev) => prev.map((i) => i.id === id ? { ...i, status: "available" } : i));
    toast.success("Integration disconnected.");
  };

  const connect = (id: string) => {
    setIntegrations((prev) => prev.map((i) => i.id === id ? { ...i, status: "connected", lastSync: new Date().toISOString() } : i));
    toast.success("Integration connected successfully!");
  };

  const connected = integrations.filter((i) => i.status === "connected");
  const available = integrations.filter((i) => i.status === "available");
  const comingSoon = integrations.filter((i) => i.status === "coming_soon");

  const IntegrationCard = ({ int }: { int: typeof INTEGRATIONS[0] }) => (
    <div className={cn("bg-card border border-border rounded-xl p-5 flex flex-col gap-3", int.status === "coming_soon" && "opacity-60")}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-xl">{int.icon}</div>
          <div>
            <p className="font-semibold text-sm">{int.name}</p>
            <p className="text-xs text-muted-foreground">{int.category}</p>
          </div>
        </div>
        {int.status === "connected" && (
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">Connected</span>
          </div>
        )}
        {int.status === "coming_soon" && (
          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full border">Coming soon</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{int.description}</p>
      {int.status === "connected" && int.lastSync && (
        <p className="text-xs text-muted-foreground">Last sync: {timeAgo(int.lastSync)}</p>
      )}
      {!int.status.includes("coming") && (
        <div className="flex gap-2 mt-auto">
          {int.status === "connected" ? (
            <>
              <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs" onClick={() => setConfigOpen(int.id)}>
                <Settings className="h-3 w-3" /> Configure
              </Button>
              <Button variant="outline" size="sm" className="text-xs gap-1 text-destructive hover:text-destructive" onClick={() => disconnect(int.id)}>
                <Unlink className="h-3 w-3" /> Disconnect
              </Button>
            </>
          ) : (
            <Button size="sm" className="flex-1 gap-1 text-xs" onClick={() => connect(int.id)}>
              <Link2 className="h-3 w-3" /> Connect
            </Button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Integrations</h1>
        <p className="text-sm text-muted-foreground">{connected.length} connected · {available.length} available</p>
      </div>

      {connected.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Connected</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connected.map((int) => <IntegrationCard key={int.id} int={int} />)}
          </div>
        </div>
      )}

      {available.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Available</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {available.map((int) => <IntegrationCard key={int.id} int={int} />)}
          </div>
        </div>
      )}

      {comingSoon.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Coming Soon</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {comingSoon.map((int) => <IntegrationCard key={int.id} int={int} />)}
          </div>
        </div>
      )}

      {/* n8n Config */}
      <Dialog open={configOpen === "n8n"} onOpenChange={(o) => !o && setConfigOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Configure n8n</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Webhook URL</Label><Input value={n8nConfig.webhookUrl} onChange={(e) => setN8nConfig({ ...n8nConfig, webhookUrl: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>API URL</Label><Input value={n8nConfig.apiUrl} onChange={(e) => setN8nConfig({ ...n8nConfig, apiUrl: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>API Key</Label><Input type="password" value={n8nConfig.apiKey} /></div>
            <div className="space-y-1.5"><Label>Webhook Secret</Label><Input type="password" value={n8nConfig.webhookSecret} /></div>
            <div className="flex items-center justify-between"><Label>Enable Error Workflow</Label><Switch checked={n8nConfig.errorWorkflow} onCheckedChange={(v) => setN8nConfig({ ...n8nConfig, errorWorkflow: v })} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfigOpen(null)}>Cancel</Button>
              <Button onClick={() => { toast.success("n8n configuration saved."); setConfigOpen(null); }}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Google Calendar Config */}
      <Dialog open={configOpen === "google-calendar"} onOpenChange={(o) => !o && setConfigOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Configure Google Calendar</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Selected Calendar</Label><Input value={gcalConfig.calendar} onChange={(e) => setGcalConfig({ ...gcalConfig, calendar: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Default Duration</Label>
                <Select value={gcalConfig.defaultDuration} onValueChange={(v) => setGcalConfig({ ...gcalConfig, defaultDuration: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["15","30","45","60"].map((d) => <SelectItem key={d} value={d}>{d} minutes</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Timezone</Label>
                <Select value={gcalConfig.timezone} onValueChange={(v) => setGcalConfig({ ...gcalConfig, timezone: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["America/New_York","Europe/Paris","Asia/Tokyo"].map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between"><Label>Enable Google Meet</Label><Switch checked={gcalConfig.googleMeet} onCheckedChange={(v) => setGcalConfig({ ...gcalConfig, googleMeet: v })} /></div>
            <div className="flex items-center justify-between"><Label>Enable Sync</Label><Switch checked={gcalConfig.syncEnabled} onCheckedChange={(v) => setGcalConfig({ ...gcalConfig, syncEnabled: v })} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfigOpen(null)}>Cancel</Button>
              <Button onClick={() => { toast.success("Google Calendar configuration saved."); setConfigOpen(null); }}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Gmail Config */}
      <Dialog open={configOpen === "gmail"} onOpenChange={(o) => !o && setConfigOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Configure Gmail</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Sender Name</Label><Input value={gmailConfig.senderName} onChange={(e) => setGmailConfig({ ...gmailConfig, senderName: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Sender Email</Label><Input type="email" value={gmailConfig.senderEmail} onChange={(e) => setGmailConfig({ ...gmailConfig, senderEmail: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Reply-To Email</Label><Input type="email" value={gmailConfig.replyTo} onChange={(e) => setGmailConfig({ ...gmailConfig, replyTo: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Email Signature</Label><textarea className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background resize-none h-20" value={gmailConfig.signature} onChange={(e) => setGmailConfig({ ...gmailConfig, signature: e.target.value })} /></div>
            <div className="flex items-center justify-between"><Label>Email Tracking</Label><Switch checked={gmailConfig.tracking} onCheckedChange={(v) => setGmailConfig({ ...gmailConfig, tracking: v })} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfigOpen(null)}>Cancel</Button>
              <Button onClick={() => { toast.success("Gmail configuration saved."); setConfigOpen(null); }}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
