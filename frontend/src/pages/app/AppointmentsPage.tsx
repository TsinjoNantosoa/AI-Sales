import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Calendar, List, Settings2, Video, Trash2, Check, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { PageLoader } from "@/components/common/LoadingSpinner";
import { appointmentService } from "@/services/appointmentService";
import { leadService } from "@/services/leadService";
import { teamService } from "@/services/teamService";
import { settingsService } from "@/services/settingsService";
import { queryKeys } from "@/lib/queryKeys";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "@/hooks/useTranslation";
import { getGoogleCalendarUrl } from "@/lib/calendar";
import type { Appointment, Settings } from "@/types";
import { cn, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay, startOfToday, addDays, addWeeks } from "date-fns";

type DayAvailability = Settings["availability"]["days"][number];

export function AppointmentsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState(startOfToday());
  const [newAppt, setNewAppt] = useState({ leadId: "", assignedUserId: "", date: "", time: "", duration: 30, type: "30-minute discovery call", notes: "", googleMeet: true });
  const [availDays, setAvailDays] = useState<DayAvailability[]>([]);
  const [availTimezone, setAvailTimezone] = useState("America/New_York");
  const [availBuffer, setAvailBuffer] = useState(15);

  const roleOpts = { currentUserId: user?.id, role: user?.role };

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: [...queryKeys.appointments.all, user?.id, user?.role],
    queryFn: () => appointmentService.getAppointments(roleOpts),
  });

  const { data: leads = [] } = useQuery({
    queryKey: [...queryKeys.leads.all, user?.id, user?.role],
    queryFn: () => leadService.getLeads(roleOpts),
  });

  const { data: users = [] } = useQuery({
    queryKey: queryKeys.team.all,
    queryFn: () => teamService.getUsers(),
  });

  const { data: settings } = useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: () => settingsService.getSettings(),
  });

  useEffect(() => {
    if (!settings?.availability) return;
    setAvailDays(settings.availability.days.map((d) => ({ ...d })));
    setAvailTimezone(settings.availability.timezone);
    setAvailBuffer(settings.availability.bufferMinutes);
  }, [settings]);

  const deleteMutation = useMutation({
    mutationFn: appointmentService.deleteAppointment,
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.appointments.all }); toast.success(t("toast.appointmentCancelled")); },
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof newAppt) => {
      const lead = leads.find((l) => l.id === data.leadId);
      const salesUser = users.find((u) => u.id === data.assignedUserId);
      return appointmentService.createAppointment({
        ...data,
        leadName: lead ? `${lead.firstName} ${lead.lastName}` : "Unknown",
        leadCompany: lead?.companyName || "",
        leadEmail: lead?.email || "",
        salespersonName: salesUser ? `${salesUser.firstName} ${salesUser.lastName}` : "Unknown",
        status: "Proposed",
        timezone: "America/New_York",
        meetingLink: data.googleMeet ? `https://meet.google.com/${Math.random().toString(36).slice(2, 11)}` : undefined,
        type: data.type as Appointment["type"],
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.appointments.all }); toast.success(t("toast.appointmentCreated")); setCreateOpen(false); },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Appointment["status"] }) => appointmentService.updateAppointment(id, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.appointments.all }); toast.success(t("toast.statusUpdated")); },
  });

  const saveAvailabilityMutation = useMutation({
    mutationFn: () =>
      settingsService.updateSettings({
        availability: {
          timezone: availTimezone,
          bufferMinutes: availBuffer,
          days: availDays,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.settings.all });
      toast.success(t("toast.availabilitySaved"));
    },
    onError: () => toast.error(t("toast.settingsSaveFailed")),
  });

  const updateDay = (day: string, patch: Partial<DayAvailability>) => {
    setAvailDays((prev) => prev.map((d) => (d.day === day ? { ...d, ...patch } : d)));
  };

  if (isLoading) return <PageLoader />;

  const calendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(calendarDate), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(calendarDate), { weekStartsOn: 1 }),
  });

  const getApptColor = (status: Appointment["status"]) => ({
    Proposed: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300",
    Confirmed: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300",
    Completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300",
    Cancelled: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300",
    "No Show": "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  }[status]);

  const openCalendar = (appt: Appointment) => {
    const url = getGoogleCalendarUrl({
      title: `${appt.type} — ${appt.leadName}`,
      date: appt.date,
      time: appt.time,
      duration: appt.duration,
      details: appt.notes || appt.meetingLink,
      location: appt.meetingLink,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("pages.appointments.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("pages.appointments.subtitle", { count: appointments.length })}</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> {t("buttons.newAppointment")}
        </Button>
      </div>

      <Tabs defaultValue="month">
        <TabsList className="mb-4 flex-wrap h-auto">
          <TabsTrigger value="month" className="gap-2"><Calendar className="h-4 w-4" />Month</TabsTrigger>
          <TabsTrigger value="week" className="gap-2">Week</TabsTrigger>
          <TabsTrigger value="day" className="gap-2">Day</TabsTrigger>
          <TabsTrigger value="list" className="gap-2"><List className="h-4 w-4" />{t("appointments.list")}</TabsTrigger>
          <TabsTrigger value="availability" className="gap-2"><Settings2 className="h-4 w-4" />{t("appointments.availability")}</TabsTrigger>
        </TabsList>

        <TabsContent value="month">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <Button variant="outline" size="sm" onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1))} aria-label="Previous month">‹</Button>
              <h3 className="font-semibold">{format(calendarDate, "MMMM yyyy")}</h3>
              <Button variant="outline" size="sm" onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1))} aria-label="Next month">›</Button>
            </div>
            <div className="grid grid-cols-7 border-b border-border">
              {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
                <div key={d} className="p-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map((day) => {
                const dayAppts = appointments.filter((a) => a.date === format(day, "yyyy-MM-dd"));
                const isToday = isSameDay(day, startOfToday());
                const inMonth = isSameMonth(day, calendarDate);
                return (
                  <div key={day.toISOString()} className={cn("min-h-[80px] p-1 border-b border-r border-border", !inMonth && "opacity-40", isToday && "bg-primary/5")}>
                    <span className={cn("text-xs font-medium block mb-1", isToday && "text-primary font-bold")}>{format(day, "d")}</span>
                    {dayAppts.slice(0, 2).map((a) => (
                      <div key={a.id} className={cn("text-[10px] px-1 py-0.5 rounded mb-0.5 truncate", getApptColor(a.status))}>
                        {a.time} {a.leadName}
                      </div>
                    ))}
                    {dayAppts.length > 2 && <span className="text-[10px] text-muted-foreground">+{dayAppts.length - 2}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="week">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <Button variant="outline" size="sm" onClick={() => setCalendarDate(addWeeks(calendarDate, -1))} aria-label="Previous week">‹</Button>
              <h3 className="font-semibold">
                Week of {format(startOfWeek(calendarDate, { weekStartsOn: 1 }), "MMM d")}
              </h3>
              <Button variant="outline" size="sm" onClick={() => setCalendarDate(addWeeks(calendarDate, 1))} aria-label="Next week">›</Button>
            </div>
            <div className="grid grid-cols-7 divide-x divide-border min-h-[320px]">
              {Array.from({ length: 7 }, (_, i) => {
                const day = addDays(startOfWeek(calendarDate, { weekStartsOn: 1 }), i);
                const dayAppts = appointments.filter((a) => a.date === format(day, "yyyy-MM-dd"));
                return (
                  <div key={day.toISOString()} className="p-2">
                    <p className={cn("text-xs font-semibold mb-2", isSameDay(day, startOfToday()) && "text-primary")}>
                      {format(day, "EEE d")}
                    </p>
                    <div className="space-y-1">
                      {dayAppts.map((a) => (
                        <div key={a.id} className={cn("text-[11px] p-1.5 rounded border", getApptColor(a.status))}>
                          <p className="font-medium">{a.time}</p>
                          <p className="truncate">{a.leadName}</p>
                        </div>
                      ))}
                      {dayAppts.length === 0 && (
                        <p className="text-[10px] text-muted-foreground">No meetings</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="day">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <Button variant="outline" size="sm" onClick={() => setCalendarDate(addDays(calendarDate, -1))} aria-label="Previous day">‹</Button>
              <h3 className="font-semibold">{format(calendarDate, "EEEE, MMM d yyyy")}</h3>
              <Button variant="outline" size="sm" onClick={() => setCalendarDate(addDays(calendarDate, 1))} aria-label="Next day">›</Button>
            </div>
            <div className="divide-y divide-border">
              {Array.from({ length: 10 }, (_, i) => {
                const hour = 8 + i;
                const label = `${String(hour).padStart(2, "0")}:00`;
                const slotAppts = appointments.filter(
                  (a) => a.date === format(calendarDate, "yyyy-MM-dd") && a.time.startsWith(String(hour).padStart(2, "0"))
                );
                return (
                  <div key={label} className="flex gap-3 p-3 min-h-[56px]">
                    <span className="text-xs text-muted-foreground w-12 shrink-0">{label}</span>
                    <div className="flex-1 space-y-1">
                      {slotAppts.map((a) => (
                        <div key={a.id} className={cn("text-sm px-3 py-2 rounded-lg border", getApptColor(a.status))}>
                          <span className="font-medium">{a.time}</span> · {a.leadName} · {a.type}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="list">
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    {["Lead", "Salesperson", "Date", "Time", "Duration", "Type", "Status", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {appointments.length === 0 ? (
                    <tr><td colSpan={8}><EmptyState icon={Calendar} title={t("empty.appointments")} description={t("empty.appointmentsDesc")} action={{ label: t("buttons.newAppointment"), onClick: () => setCreateOpen(true) }} /></td></tr>
                  ) : appointments.map((appt) => (
                    <tr key={appt.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium">{appt.leadName}</p>
                        <p className="text-xs text-muted-foreground">{appt.leadCompany}</p>
                      </td>
                      <td className="px-4 py-3 text-xs">{appt.salespersonName}</td>
                      <td className="px-4 py-3 text-xs">{formatDate(appt.date)}</td>
                      <td className="px-4 py-3 text-xs">{appt.time}</td>
                      <td className="px-4 py-3 text-xs">{appt.duration} min</td>
                      <td className="px-4 py-3 text-xs max-w-[120px]">
                        <span className="truncate block">{appt.type}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", getApptColor(appt.status))}>{appt.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {appt.status === "Proposed" && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={() => updateStatusMutation.mutate({ id: appt.id, status: "Confirmed" })}>
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                          {appt.meetingLink && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-primary"
                              title={t("appointments.googleMeet")}
                              onClick={() => window.open(appt.meetingLink, "_blank", "noopener,noreferrer")}
                            >
                              <Video className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground"
                            title={t("buttons.addToCalendar")}
                            onClick={() => openCalendar(appt)}
                          >
                            <CalendarPlus className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(appt.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="availability">
          <div className="max-w-2xl space-y-4">
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold mb-4">Working Hours</h3>
              <div className="space-y-3">
                {(availDays.length ? availDays : []).map((day) => (
                  <div key={day.day} className={cn("flex items-center justify-between", !day.enabled && "opacity-50")}>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={day.enabled}
                        onCheckedChange={(v) => updateDay(day.day, { enabled: v })}
                      />
                      <span className="text-sm">{day.day}</span>
                    </div>
                    {day.enabled ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Select value={day.start} onValueChange={(v) => updateDay(day.day, { start: v })}>
                          <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                          <SelectContent>{["08:00","09:00","10:00"].map((tm) => <SelectItem key={tm} value={tm}>{tm}</SelectItem>)}</SelectContent>
                        </Select>
                        <span className="text-muted-foreground">to</span>
                        <Select value={day.end} onValueChange={(v) => updateDay(day.day, { end: v })}>
                          <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                          <SelectContent>{["13:00","17:00","18:00","19:00"].map((tm) => <SelectItem key={tm} value={tm}>{tm}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not available</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold mb-4">Meeting Settings</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Buffer Between Meetings</Label>
                  <Select value={String(availBuffer)} onValueChange={(v) => setAvailBuffer(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["0","10","15","30"].map((d) => <SelectItem key={d} value={d}>{d === "0" ? "None" : `${d} minutes`}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("appointments.timezone")}</Label>
                  <Select value={availTimezone} onValueChange={setAvailTimezone}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["America/New_York","America/Chicago","America/Los_Angeles","Europe/London","Europe/Paris"].map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="mt-4" onClick={() => saveAvailabilityMutation.mutate()} disabled={saveAvailabilityMutation.isPending || availDays.length === 0}>
                {t("buttons.saveSettings")}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("buttons.newAppointment")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Lead *</Label>
              <Select onValueChange={(v) => setNewAppt({ ...newAppt, leadId: v })}>
                <SelectTrigger><SelectValue placeholder="Select lead" /></SelectTrigger>
                <SelectContent>{leads.slice(0, 10).map((l) => <SelectItem key={l.id} value={l.id}>{l.firstName} {l.lastName} — {l.companyName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Salesperson *</Label>
              <Select onValueChange={(v) => setNewAppt({ ...newAppt, assignedUserId: v })}>
                <SelectTrigger><SelectValue placeholder="Select salesperson" /></SelectTrigger>
                <SelectContent>{users.filter((u) => u.role !== "ADMIN").map((u) => <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Input type="date" value={newAppt.date} onChange={(e) => setNewAppt({ ...newAppt, date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Time *</Label>
                <Input type="time" value={newAppt.time} onChange={(e) => setNewAppt({ ...newAppt, time: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Meeting Type</Label>
              <Select defaultValue="30-minute discovery call" onValueChange={(v) => setNewAppt({ ...newAppt, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["15-minute introduction","30-minute discovery call","60-minute technical consultation"].map((tm) => <SelectItem key={tm} value={tm}>{tm}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>{t("appointments.googleMeet")}</Label>
              <Switch checked={newAppt.googleMeet} onCheckedChange={(v) => setNewAppt({ ...newAppt, googleMeet: v })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>{t("buttons.cancel")}</Button>
              <Button onClick={() => createMutation.mutate(newAppt)} disabled={!newAppt.leadId || !newAppt.date || !newAppt.time}>{t("common.create")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Cancel Appointment"
        description="Are you sure you want to cancel this appointment? The lead will be notified."
        confirmLabel="Cancel Appointment"
        onConfirm={() => { if (deleteId) { deleteMutation.mutate(deleteId); setDeleteId(null); } }}
      />
    </div>
  );
}
