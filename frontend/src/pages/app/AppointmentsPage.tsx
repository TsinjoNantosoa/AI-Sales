import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Calendar, List, Settings2, Video, Clock, Trash2, Check, X } from "lucide-react";
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
import { mockLeads, mockUsers } from "@/mocks/data";
import type { Appointment } from "@/types";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay, startOfToday } from "date-fns";

export function AppointmentsPage() {
  const qc = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState(startOfToday());
  const [newAppt, setNewAppt] = useState({ leadId: "", assignedUserId: "", date: "", time: "", duration: 30, type: "30-minute discovery call", notes: "", googleMeet: true });

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["appointments"],
    queryFn: appointmentService.getAppointments,
  });

  const deleteMutation = useMutation({
    mutationFn: appointmentService.deleteAppointment,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["appointments"] }); toast.success("Appointment cancelled."); },
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof newAppt) => {
      const lead = mockLeads.find((l) => l.id === data.leadId);
      const salesUser = mockUsers.find((u) => u.id === data.assignedUserId);
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["appointments"] }); toast.success("Appointment created successfully."); setCreateOpen(false); },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Appointment["status"] }) => appointmentService.updateAppointment(id, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["appointments"] }); toast.success("Status updated."); },
  });

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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Appointments</h1>
          <p className="text-sm text-muted-foreground">{appointments.length} total appointments</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New Appointment
        </Button>
      </div>

      <Tabs defaultValue="list">
        <TabsList className="mb-4">
          <TabsTrigger value="calendar" className="gap-2"><Calendar className="h-4 w-4" />Calendar</TabsTrigger>
          <TabsTrigger value="list" className="gap-2"><List className="h-4 w-4" />List</TabsTrigger>
          <TabsTrigger value="availability" className="gap-2"><Settings2 className="h-4 w-4" />Availability</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <Button variant="outline" size="sm" onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1))}>‹</Button>
              <h3 className="font-semibold">{format(calendarDate, "MMMM yyyy")}</h3>
              <Button variant="outline" size="sm" onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1))}>›</Button>
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

          {/* Google Calendar Integration Card */}
          <div className="mt-4 bg-card border border-border rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-medium text-sm">Google Calendar</p>
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  <p className="text-xs text-muted-foreground">Connected · Last sync 2 minutes ago</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => toast.success("Calendar synchronized!")}>Synchronize</Button>
              <Button variant="outline" size="sm" onClick={() => toast.info("Opening Google Calendar...")}>Open Calendar</Button>
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
                    <tr><td colSpan={8}><EmptyState icon={Calendar} title="No appointments" description="Create your first appointment to get started." action={{ label: "New Appointment", onClick: () => setCreateOpen(true) }} /></td></tr>
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
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => toast.info("Opening Google Meet...")}>
                              <Video className="h-4 w-4" />
                            </Button>
                          )}
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
                {["Monday","Tuesday","Wednesday","Thursday","Friday"].map((day) => (
                  <div key={day} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Switch defaultChecked />
                      <span className="text-sm">{day}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Select defaultValue="09:00"><SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                        <SelectContent>{["08:00","09:00","10:00"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                      <span className="text-muted-foreground">to</span>
                      <Select defaultValue="18:00"><SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                        <SelectContent>{["17:00","18:00","19:00"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
                {["Saturday","Sunday"].map((day) => (
                  <div key={day} className="flex items-center justify-between opacity-50">
                    <div className="flex items-center gap-3"><Switch /><span className="text-sm">{day}</span></div>
                    <span className="text-xs text-muted-foreground">Not available</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold mb-4">Meeting Settings</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Default Duration</Label>
                  <Select defaultValue="30">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["15","30","45","60"].map((d) => <SelectItem key={d} value={d}>{d} minutes</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Buffer Between Meetings</Label>
                  <Select defaultValue="15">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["0","10","15","30"].map((d) => <SelectItem key={d} value={d}>{d || "None"} {d ? "minutes" : ""}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Timezone</Label>
                  <Select defaultValue="America/New_York"><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["America/New_York","America/Chicago","America/Los_Angeles","Europe/London","Europe/Paris"].map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between pt-6">
                  <Label>Google Meet</Label>
                  <Switch defaultChecked />
                </div>
              </div>
              <Button className="mt-4" onClick={() => toast.success("Availability settings saved!")}>Save Settings</Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Appointment Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Appointment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Lead *</Label>
              <Select onValueChange={(v) => setNewAppt({ ...newAppt, leadId: v })}>
                <SelectTrigger><SelectValue placeholder="Select lead" /></SelectTrigger>
                <SelectContent>{mockLeads.slice(0, 10).map((l) => <SelectItem key={l.id} value={l.id}>{l.firstName} {l.lastName} — {l.companyName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Salesperson *</Label>
              <Select onValueChange={(v) => setNewAppt({ ...newAppt, assignedUserId: v })}>
                <SelectTrigger><SelectValue placeholder="Select salesperson" /></SelectTrigger>
                <SelectContent>{mockUsers.filter((u) => u.role !== "ADMIN").map((u) => <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>)}</SelectContent>
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
                  {["15-minute introduction","30-minute discovery call","60-minute technical consultation"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Google Meet</Label>
              <Switch checked={newAppt.googleMeet} onCheckedChange={(v) => setNewAppt({ ...newAppt, googleMeet: v })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={() => createMutation.mutate(newAppt)} disabled={!newAppt.leadId || !newAppt.date || !newAppt.time}>Create</Button>
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
