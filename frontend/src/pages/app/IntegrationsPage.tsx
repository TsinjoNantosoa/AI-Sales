import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageLoader } from "@/components/common/LoadingSpinner";
import { cn, timeAgo } from "@/lib/utils";
import { integrationService } from "@/services/integrationService";
import { queryKeys } from "@/lib/queryKeys";
import type { Integration } from "@/types";
import { toast } from "sonner";
import { Settings, Link2, Unlink, RefreshCw, PlugZap } from "lucide-react";

const MASK = "••••••••••••••";

const LOGO_ICON: Record<string, string> = {
  n8n: "⚡",
  calendar: "📅",
  mail: "📧",
  hubspot: "🔶",
  slack: "💬",
  openai: "🤖",
  odoo: "🟣",
  airtable: "📊",
  teams: "🟦",
  whatsapp: "💚",
  twilio: "📱",
  outlook: "📆",
};

type ConfigKind = "n8n" | "google-calendar" | "gmail" | "generic";

function configKindFor(int: Integration): ConfigKind {
  const n = int.name.toLowerCase();
  const logo = int.logo?.toLowerCase() ?? "";
  if (n.includes("n8n") || logo === "n8n") return "n8n";
  if (n.includes("gmail") || logo === "mail") return "gmail";
  if ((n.includes("google") && n.includes("calendar")) || logo === "calendar") return "google-calendar";
  return "generic";
}

/** Strip / mask secret-looking values before sending to configure. */
function sanitizeConfig(config: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(config)) {
    const lower = key.toLowerCase();
    const isSecret = lower.includes("key") || lower.includes("secret") || lower.includes("token") || lower.includes("password");
    if (isSecret) {
      if (!value || value.includes("•")) continue;
      out[key] = MASK;
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function IntegrationsPage() {
  const qc = useQueryClient();
  const [configOpen, setConfigOpen] = useState<string | null>(null);
  const [n8nConfig, setN8nConfig] = useState({
    webhookUrl: "https://n8n.company.com/webhook/aisales",
    apiUrl: "https://n8n.company.com",
    apiKey: `n8n_api_${MASK}`,
    webhookSecret: `wh_secret_${MASK}`,
    errorWorkflow: true,
  });
  const [gcalConfig, setGcalConfig] = useState({
    calendar: "Primary Calendar",
    defaultDuration: "30",
    timezone: "America/New_York",
    googleMeet: true,
    syncEnabled: true,
  });
  const [gmailConfig, setGmailConfig] = useState({
    senderName: "AI Sales Assistant",
    senderEmail: "noreply@aisales.demo",
    replyTo: "sales@aisales.demo",
    signature: "Best regards,\nAI Sales Assistant Team",
    tracking: true,
  });
  const [genericNotes, setGenericNotes] = useState("");

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: queryKeys.integrations.all,
    queryFn: () => integrationService.getIntegrations(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.integrations.all });

  const connectMutation = useMutation({
    mutationFn: (id: string) => integrationService.connect(id),
    onSuccess: () => {
      invalidate();
      toast.success("Integration connected successfully!");
    },
    onError: () => toast.error("Failed to connect integration."),
  });

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => integrationService.disconnect(id),
    onSuccess: () => {
      invalidate();
      toast.success("Integration disconnected.");
    },
    onError: () => toast.error("Failed to disconnect."),
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => integrationService.testConnection(id),
    onSuccess: (result) => {
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    },
    onError: () => toast.error("Connection test failed."),
  });

  const syncMutation = useMutation({
    mutationFn: (id: string) => integrationService.synchronize(id),
    onSuccess: () => {
      invalidate();
      toast.success("Synchronization complete.");
    },
    onError: () => toast.error("Synchronization failed."),
  });

  const configureMutation = useMutation({
    mutationFn: ({ id, config }: { id: string; config: Record<string, string> }) =>
      integrationService.configure(id, sanitizeConfig(config)),
    onSuccess: () => {
      invalidate();
      toast.success("Configuration saved.");
      setConfigOpen(null);
      // Remask secrets in local UI state — never keep real secrets
      setN8nConfig((c) => ({
        ...c,
        apiKey: c.apiKey.includes("•") ? c.apiKey : `n8n_api_${MASK}`,
        webhookSecret: c.webhookSecret.includes("•") ? c.webhookSecret : `wh_secret_${MASK}`,
      }));
    },
    onError: () => toast.error("Failed to save configuration."),
  });

  if (isLoading) return <PageLoader />;

  const connected = integrations.filter((i) => i.status === "connected");
  const available = integrations.filter((i) => i.status === "available");
  const comingSoon = integrations.filter((i) => i.status === "coming_soon");

  const activeIntegration = configOpen
    ? integrations.find((i) => i.id === configOpen) ?? null
    : null;
  const activeKind = activeIntegration ? configKindFor(activeIntegration) : null;

  const IntegrationCard = ({ int }: { int: Integration }) => (
    <div className={cn("bg-card border border-border rounded-xl p-5 flex flex-col gap-3", int.status === "coming_soon" && "opacity-60")}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-xl">
            {LOGO_ICON[int.logo] ?? "🔌"}
          </div>
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
      {int.status !== "coming_soon" && (
        <div className="flex flex-wrap gap-2 mt-auto">
          {int.status === "connected" ? (
            <>
              <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs" onClick={() => setConfigOpen(int.id)}>
                <Settings className="h-3 w-3" /> Configure
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-xs"
                disabled={testMutation.isPending}
                onClick={() => testMutation.mutate(int.id)}
              >
                <PlugZap className="h-3 w-3" /> Test
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-xs"
                disabled={syncMutation.isPending}
                onClick={() => syncMutation.mutate(int.id)}
              >
                <RefreshCw className={cn("h-3 w-3", syncMutation.isPending && syncMutation.variables === int.id && "animate-spin")} /> Sync
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1 text-destructive hover:text-destructive"
                disabled={disconnectMutation.isPending}
                onClick={() => disconnectMutation.mutate(int.id)}
              >
                <Unlink className="h-3 w-3" /> Disconnect
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              className="flex-1 gap-1 text-xs"
              disabled={connectMutation.isPending}
              onClick={() => connectMutation.mutate(int.id)}
            >
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
      <Dialog open={!!activeIntegration && activeKind === "n8n"} onOpenChange={(o) => !o && setConfigOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Configure n8n</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Webhook URL</Label>
              <Input value={n8nConfig.webhookUrl} onChange={(e) => setN8nConfig({ ...n8nConfig, webhookUrl: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>API URL</Label>
              <Input value={n8nConfig.apiUrl} onChange={(e) => setN8nConfig({ ...n8nConfig, apiUrl: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>API Key</Label>
              <Input
                type="password"
                value={n8nConfig.apiKey}
                onChange={(e) => setN8nConfig({ ...n8nConfig, apiKey: e.target.value })}
                placeholder={`n8n_api_${MASK}`}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Webhook Secret</Label>
              <Input
                type="password"
                value={n8nConfig.webhookSecret}
                onChange={(e) => setN8nConfig({ ...n8nConfig, webhookSecret: e.target.value })}
                placeholder={`wh_secret_${MASK}`}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Enable Error Workflow</Label>
              <Switch checked={n8nConfig.errorWorkflow} onCheckedChange={(v) => setN8nConfig({ ...n8nConfig, errorWorkflow: v })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfigOpen(null)}>Cancel</Button>
              <Button
                disabled={configureMutation.isPending || !configOpen}
                onClick={() => {
                  if (!configOpen) return;
                  configureMutation.mutate({
                    id: configOpen,
                    config: {
                      webhookUrl: n8nConfig.webhookUrl,
                      apiUrl: n8nConfig.apiUrl,
                      apiKey: n8nConfig.apiKey,
                      webhookSecret: n8nConfig.webhookSecret,
                      errorWorkflow: String(n8nConfig.errorWorkflow),
                    },
                  });
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Google Calendar Config */}
      <Dialog open={!!activeIntegration && activeKind === "google-calendar"} onOpenChange={(o) => !o && setConfigOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Configure Google Calendar</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Selected Calendar</Label>
              <Input value={gcalConfig.calendar} onChange={(e) => setGcalConfig({ ...gcalConfig, calendar: e.target.value })} />
            </div>
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
            <div className="flex items-center justify-between">
              <Label>Enable Google Meet</Label>
              <Switch checked={gcalConfig.googleMeet} onCheckedChange={(v) => setGcalConfig({ ...gcalConfig, googleMeet: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Enable Sync</Label>
              <Switch checked={gcalConfig.syncEnabled} onCheckedChange={(v) => setGcalConfig({ ...gcalConfig, syncEnabled: v })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfigOpen(null)}>Cancel</Button>
              <Button
                disabled={configureMutation.isPending || !configOpen}
                onClick={() => {
                  if (!configOpen) return;
                  configureMutation.mutate({
                    id: configOpen,
                    config: {
                      calendar: gcalConfig.calendar,
                      defaultDuration: gcalConfig.defaultDuration,
                      timezone: gcalConfig.timezone,
                      googleMeet: String(gcalConfig.googleMeet),
                      syncEnabled: String(gcalConfig.syncEnabled),
                    },
                  });
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Gmail Config */}
      <Dialog open={!!activeIntegration && activeKind === "gmail"} onOpenChange={(o) => !o && setConfigOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Configure Gmail</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Sender Name</Label>
                <Input value={gmailConfig.senderName} onChange={(e) => setGmailConfig({ ...gmailConfig, senderName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Sender Email</Label>
                <Input type="email" value={gmailConfig.senderEmail} onChange={(e) => setGmailConfig({ ...gmailConfig, senderEmail: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reply-To Email</Label>
              <Input type="email" value={gmailConfig.replyTo} onChange={(e) => setGmailConfig({ ...gmailConfig, replyTo: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Email Signature</Label>
              <textarea
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background resize-none h-20"
                value={gmailConfig.signature}
                onChange={(e) => setGmailConfig({ ...gmailConfig, signature: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Email Tracking</Label>
              <Switch checked={gmailConfig.tracking} onCheckedChange={(v) => setGmailConfig({ ...gmailConfig, tracking: v })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfigOpen(null)}>Cancel</Button>
              <Button
                disabled={configureMutation.isPending || !configOpen}
                onClick={() => {
                  if (!configOpen) return;
                  configureMutation.mutate({
                    id: configOpen,
                    config: {
                      senderName: gmailConfig.senderName,
                      senderEmail: gmailConfig.senderEmail,
                      replyTo: gmailConfig.replyTo,
                      signature: gmailConfig.signature,
                      tracking: String(gmailConfig.tracking),
                    },
                  });
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Generic Config */}
      <Dialog open={!!activeIntegration && activeKind === "generic"} onOpenChange={(o) => !o && setConfigOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure {activeIntegration?.name ?? "Integration"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input
                value={genericNotes}
                onChange={(e) => setGenericNotes(e.target.value)}
                placeholder="Optional configuration notes"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Secrets are never stored in the browser. Connection credentials are handled server-side.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfigOpen(null)}>Cancel</Button>
              <Button
                disabled={configureMutation.isPending || !configOpen}
                onClick={() => {
                  if (!configOpen) return;
                  configureMutation.mutate({
                    id: configOpen,
                    config: { notes: genericNotes },
                  });
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
