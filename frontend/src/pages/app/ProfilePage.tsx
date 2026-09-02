import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserCircle, Camera, Bell, Lock, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/common/Avatar";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "@/hooks/useTranslation";
import { teamService } from "@/services/teamService";
import { authService } from "@/services/authService";
import { settingsService } from "@/services/settingsService";
import { integrationService } from "@/services/integrationService";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "sonner";

const profileSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  language: z.string(),
  timezone: z.string(),
});
type ProfileData = z.infer<typeof profileSchema>;

const pwSchema = z.object({
  currentPassword: z.string().min(1, "Required"),
  newPassword: z.string().min(8, "Minimum 8 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });
type PwData = z.infer<typeof pwSchema>;

export function ProfilePage() {
  const { t } = useTranslation();
  const { user, updateUser } = useAuthStore();
  const qc = useQueryClient();
  const [notifPrefs, setNotifPrefs] = useState({
    emailEnabled: true,
    inAppEnabled: true,
    hotLeadAlerts: true,
    meetingReminders: true,
  });

  const { data: settings } = useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: () => settingsService.getSettings(),
  });

  const { data: integrations = [] } = useQuery({
    queryKey: queryKeys.integrations.all,
    queryFn: () => integrationService.getIntegrations(),
  });

  useEffect(() => {
    if (!settings?.notifications) return;
    setNotifPrefs({ ...settings.notifications });
  }, [settings]);

  const googleCalendar = integrations.find(
    (i) => i.id === "int1" || i.name.toLowerCase().includes("google calendar")
  );
  const calendarConnected = googleCalendar?.status === "connected";

  const profileForm = useForm<ProfileData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      email: user?.email ?? "",
      language: user?.language ?? "en",
      timezone: user?.timezone ?? "America/New_York",
    },
  });

  const pwForm = useForm<PwData>({ resolver: zodResolver(pwSchema) });

  const onProfileSave = async (data: ProfileData) => {
    if (!user) return;
    updateUser({
      firstName: data.firstName,
      lastName: data.lastName,
      language: data.language as "en" | "fr",
      timezone: data.timezone,
    });
    await teamService.updateUser(user.id, {
      firstName: data.firstName,
      lastName: data.lastName,
      language: data.language as "en" | "fr",
      timezone: data.timezone,
      email: data.email,
    });
    qc.invalidateQueries({ queryKey: queryKeys.team.all });
    toast.success(t("toast.profileUpdated"));
  };

  const onPasswordChange = async (data: PwData) => {
    if (!user?.email) return;
    try {
      const token = `mock-reset-${btoa(user.email)}`;
      await authService.resetPassword(token, data.newPassword);
      toast.success(t("toast.passwordChanged"));
      pwForm.reset();
    } catch {
      toast.error(t("toast.accessDenied"));
    }
  };

  const saveNotifMutation = useMutation({
    mutationFn: () => settingsService.updateSettings({ notifications: notifPrefs }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.settings.all });
      toast.success(t("toast.notificationsSaved"));
    },
    onError: () => toast.error(t("toast.settingsSaveFailed")),
  });

  const connectCalendar = async () => {
    try {
      if (googleCalendar) {
        await integrationService.connect(googleCalendar.id);
        qc.invalidateQueries({ queryKey: queryKeys.integrations.all });
        if (user) {
          await teamService.updateUser(user.id, { calendarConnected: true });
        }
        toast.success(t("toast.calendarConnected"));
      } else {
        toast.info(t("toast.calendarConnected"));
        await settingsService.updateSettings({});
      }
    } catch {
      toast.error(t("toast.accessDenied"));
    }
  };

  if (!user) return null;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-6">{t("profile.title")}</h1>

      <Tabs defaultValue="profile">
        <TabsList className="mb-6">
          <TabsTrigger value="profile" className="gap-2"><UserCircle className="h-4 w-4" />{t("profile.title")}</TabsTrigger>
          <TabsTrigger value="password" className="gap-2"><Lock className="h-4 w-4" />{t("profile.password")}</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2"><Bell className="h-4 w-4" />{t("profile.notifications")}</TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2"><Calendar className="h-4 w-4" />{t("profile.calendar")}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border">
              <div className="relative">
                <UserAvatar firstName={user.firstName} lastName={user.lastName} id={user.id} size="lg" />
                <button className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-primary flex items-center justify-center border-2 border-background hover:bg-primary/90 transition-colors">
                  <Camera className="h-3 w-3 text-white" />
                </button>
              </div>
              <div>
                <p className="font-semibold">{user.firstName} {user.lastName}</p>
                <p className="text-sm text-muted-foreground">{user.role.replace(/_/g, " ")}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>

            <form onSubmit={profileForm.handleSubmit(onProfileSave)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>First Name</Label>
                  <Input {...profileForm.register("firstName")} />
                  {profileForm.formState.errors.firstName && <p className="text-xs text-destructive">{profileForm.formState.errors.firstName.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Last Name</Label>
                  <Input {...profileForm.register("lastName")} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t("common.email")}</Label>
                <Input type="email" {...profileForm.register("email")} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("common.phone")}</Label>
                <Input type="tel" {...profileForm.register("phone")} placeholder="+1 555 000 0000" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("common.language")}</Label>
                  <Select value={profileForm.watch("language")} onValueChange={(v) => profileForm.setValue("language", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="fr">Français</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Timezone</Label>
                  <Select value={profileForm.watch("timezone")} onValueChange={(v) => profileForm.setValue("timezone", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["America/New_York","America/Chicago","America/Los_Angeles","Europe/London","Europe/Paris"].map((tz) => (
                        <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground"><strong>Role:</strong> {user.role.replace(/_/g, " ")} — Contact your administrator to change your role.</p>
              </div>
              <Button type="submit">{t("profile.saveProfile")}</Button>
            </form>
          </div>
        </TabsContent>

        <TabsContent value="password">
          <div className="bg-card border border-border rounded-xl p-6">
            <form onSubmit={pwForm.handleSubmit(onPasswordChange)} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Current Password</Label>
                <Input type="password" {...pwForm.register("currentPassword")} placeholder="••••••••" />
                {pwForm.formState.errors.currentPassword && <p className="text-xs text-destructive">{pwForm.formState.errors.currentPassword.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>{t("auth.newPassword")}</Label>
                <Input type="password" {...pwForm.register("newPassword")} placeholder="Minimum 8 characters" />
                {pwForm.formState.errors.newPassword && <p className="text-xs text-destructive">{pwForm.formState.errors.newPassword.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>{t("auth.confirmPassword")}</Label>
                <Input type="password" {...pwForm.register("confirmPassword")} placeholder="Repeat new password" />
                {pwForm.formState.errors.confirmPassword && <p className="text-xs text-destructive">{pwForm.formState.errors.confirmPassword.message}</p>}
              </div>
              <Button type="submit">{t("profile.changePassword")}</Button>
            </form>
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h3 className="font-semibold">My Notification Preferences</h3>
            {(
              [
                { key: "hotLeadAlerts" as const, label: "Hot lead alerts" },
                { key: "meetingReminders" as const, label: "Meeting reminders" },
                { key: "emailEnabled" as const, label: "Email notifications" },
                { key: "inAppEnabled" as const, label: "In-app notifications" },
              ] as const
            ).map((n) => (
              <div key={n.key} className="flex items-center justify-between">
                <p className="text-sm">{n.label}</p>
                <Switch
                  checked={notifPrefs[n.key]}
                  onCheckedChange={(v) => setNotifPrefs((prev) => ({ ...prev, [n.key]: v }))}
                />
              </div>
            ))}
            <Button onClick={() => saveNotifMutation.mutate()} disabled={saveNotifMutation.isPending}>
              {t("buttons.save")}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="calendar">
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h3 className="font-semibold">Calendar Connection</h3>
            <div className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-green-700 dark:text-green-400" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-medium text-sm">Google Calendar</p>
                  <p className="text-xs text-muted-foreground">
                    {calendarConnected ? t("profile.connected") : t("profile.notConnected")}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={connectCalendar}>
                {calendarConnected ? t("buttons.sync") : t("buttons.connect")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("profile.connectCalendarHint")}
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
