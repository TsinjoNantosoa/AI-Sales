import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserCircle, Camera, Bell, Lock, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/common/Avatar";
import { useAuthStore } from "@/stores/authStore";
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
  const { user, updateUser } = useAuthStore();

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

  const onProfileSave = (data: ProfileData) => {
    updateUser({ firstName: data.firstName, lastName: data.lastName, language: data.language as "en" | "fr", timezone: data.timezone });
    toast.success("Profile updated successfully.");
  };

  const onPasswordChange = async (data: PwData) => {
    void data;
    await new Promise((r) => setTimeout(r, 500));
    toast.success("Password changed successfully.");
    pwForm.reset();
  };

  if (!user) return null;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-6">My Profile</h1>

      <Tabs defaultValue="profile">
        <TabsList className="mb-6">
          <TabsTrigger value="profile" className="gap-2"><UserCircle className="h-4 w-4" />Profile</TabsTrigger>
          <TabsTrigger value="password" className="gap-2"><Lock className="h-4 w-4" />Password</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2"><Bell className="h-4 w-4" />Notifications</TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2"><Calendar className="h-4 w-4" />Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="bg-card border border-border rounded-xl p-6">
            {/* Avatar */}
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
                <Label>Email</Label>
                <Input type="email" {...profileForm.register("email")} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input type="tel" {...profileForm.register("phone")} placeholder="+1 555 000 0000" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Language</Label>
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
              <Button type="submit">Save Profile</Button>
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
                <Label>New Password</Label>
                <Input type="password" {...pwForm.register("newPassword")} placeholder="Minimum 8 characters" />
                {pwForm.formState.errors.newPassword && <p className="text-xs text-destructive">{pwForm.formState.errors.newPassword.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Confirm Password</Label>
                <Input type="password" {...pwForm.register("confirmPassword")} placeholder="Repeat new password" />
                {pwForm.formState.errors.confirmPassword && <p className="text-xs text-destructive">{pwForm.formState.errors.confirmPassword.message}</p>}
              </div>
              <Button type="submit">Change Password</Button>
            </form>
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h3 className="font-semibold">My Notification Preferences</h3>
            {[
              { label: "New lead assigned to me" },
              { label: "Meeting reminders" },
              { label: "Task due soon" },
              { label: "Workflow failures" },
              { label: "Hot lead alerts" },
            ].map((n) => (
              <div key={n.label} className="flex items-center justify-between">
                <p className="text-sm">{n.label}</p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5"><Switch defaultChecked /><span className="text-xs text-muted-foreground">Email</span></div>
                  <div className="flex items-center gap-1.5"><Switch defaultChecked /><span className="text-xs text-muted-foreground">In-app</span></div>
                </div>
              </div>
            ))}
            <Button onClick={() => toast.success("Notification preferences saved.")}>Save Preferences</Button>
          </div>
        </TabsContent>

        <TabsContent value="calendar">
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h3 className="font-semibold">Calendar Connection</h3>
            <div className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center text-xl">📅</div>
                <div>
                  <p className="font-medium text-sm">Google Calendar</p>
                  <p className="text-xs text-muted-foreground">
                    {user ? "Not connected" : "Reconnect your calendar"}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => toast.success("Google Calendar connected! (Demo mode)")}>
                Connect
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Connect your Google Calendar to sync meetings and receive availability-based booking links.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
