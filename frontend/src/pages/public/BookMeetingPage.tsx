import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft, Clock, Video, Calendar, CheckCircle2, Bot, ExternalLink, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatDate } from "@/lib/utils";
import { format, addDays, startOfToday, isSameDay } from "date-fns";
import { appointmentService } from "@/services/appointmentService";
import { leadService } from "@/services/leadService";
import { getGoogleCalendarUrl } from "@/lib/calendar";
import { DEFAULT_ASSIGNEE_ID } from "@/lib/constants";
import { teamService } from "@/services/teamService";
import type { Appointment, Lead } from "@/types";
import { toast } from "sonner";

const MEETING_TYPES = [
  { id: "intro", label: "15-minute Introduction", duration: 15, type: "15-minute introduction" as const },
  { id: "discovery", label: "30-minute Discovery Call", duration: 30, type: "30-minute discovery call" as const },
  { id: "technical", label: "60-minute Technical Consultation", duration: 60, type: "60-minute technical consultation" as const },
];

const formSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  email: z.string().email("Invalid email"),
  company: z.string().optional(),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

export function BookMeetingPage() {
  const [params] = useSearchParams();
  const leadIdParam = params.get("leadId") || sessionStorage.getItem("publicLeadId") || "";

  const [step, setStep] = useState(0);
  const [selectedType, setSelectedType] = useState<typeof MEETING_TYPES[0] | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [lead, setLead] = useState<Lead | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { firstName: "", lastName: "", email: "", company: "", notes: "" },
  });

  const today = startOfToday();
  const daysInView = Array.from({ length: 14 }, (_, i) => addDays(today, i + 1 + weekOffset * 7));

  useEffect(() => {
    if (!leadIdParam) return;
    void leadService.getLead(leadIdParam).then((l) => {
      setLead(l);
      form.reset({
        firstName: l.firstName,
        lastName: l.lastName,
        email: l.email,
        company: l.companyName,
        notes: "",
      });
    }).catch(() => undefined);
  }, [leadIdParam, form]);

  useEffect(() => {
    if (!selectedDate) return;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    void appointmentService.getAvailableSlots(dateStr, DEFAULT_ASSIGNEE_ID).then(setSlots);
  }, [selectedDate]);

  const handleConfirm = form.handleSubmit(async (values) => {
    if (!selectedDate || !selectedSlot || !selectedType) return;
    setLoading(true);
    try {
      let activeLead = lead;
      if (!activeLead) {
        activeLead = await leadService.createLead({
          firstName: values.firstName,
          lastName: values.lastName,
          companyName: values.company || "Unknown",
          email: values.email,
          country: "Unknown",
          source: "Website",
          serviceInterest: "Other",
          needDescription: values.notes || "Booked via public calendar",
          consentGiven: true,
          status: "NEW",
        });
        sessionStorage.setItem("publicLeadId", activeLead.id);
        setLead(activeLead);
      }

      const assignee = await teamService.getUser(activeLead.assignedUserId || DEFAULT_ASSIGNEE_ID).catch(() => null);
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const appt = await appointmentService.createAppointment({
        leadId: activeLead.id,
        leadName: `${values.firstName} ${values.lastName}`,
        leadCompany: values.company || activeLead.companyName,
        leadEmail: values.email,
        assignedUserId: activeLead.assignedUserId || DEFAULT_ASSIGNEE_ID,
        salespersonName: assignee ? `${assignee.firstName} ${assignee.lastName}` : "Sarah Johnson",
        date: dateStr,
        time: selectedSlot,
        duration: selectedType.duration,
        timezone: "America/New_York",
        type: selectedType.type,
        status: "Confirmed",
        meetingLink: `https://meet.google.com/ais-${activeLead.id.slice(-6)}`,
        notes: values.notes,
        googleMeet: true,
      });

      await leadService.moveLead(activeLead.id, "MEETING_SCHEDULED");
      setAppointment(appt);
      setConfirmed(true);
      toast.success("Meeting confirmed!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setLoading(false);
    }
  });

  const openGoogleCalendar = () => {
    if (!appointment || !selectedType) return;
    const url = getGoogleCalendarUrl({
      title: `${selectedType.label} — AI Sales Assistant`,
      date: appointment.date,
      time: appointment.time,
      duration: appointment.duration,
      details: appointment.notes || "Discovery meeting with AI Sales Assistant",
      location: appointment.meetingLink,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (confirmed && selectedDate && selectedSlot && selectedType && appointment) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Meeting Confirmed!</h1>
          <p className="text-muted-foreground mb-8">Your appointment is linked to your lead profile in our CRM.</p>

          <div className="bg-card rounded-xl border border-border p-6 text-left space-y-4 mb-6">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">{formatDate(selectedDate)}</p>
                <p className="text-xs text-muted-foreground">{selectedSlot} · {selectedType.duration} minutes</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-primary" />
              <p className="text-sm">America/New_York (EST)</p>
            </div>
            <div className="flex items-center gap-3">
              <Bot className="h-5 w-5 text-primary" />
              <p className="text-sm">With {appointment.salespersonName}</p>
            </div>
            {appointment.meetingLink && (
              <div className="flex items-center gap-3">
                <Video className="h-5 w-5 text-primary" />
                <a href={appointment.meetingLink} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                  {appointment.meetingLink} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Button className="w-full" variant="outline" onClick={openGoogleCalendar}>
              <Calendar className="h-4 w-4 mr-2" /> Add to Google Calendar
            </Button>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => {
                setConfirmed(false);
                setStep(0);
                setSelectedType(null);
                setSelectedDate(null);
                setSelectedSlot(null);
              }}
            >
              Reschedule
            </Button>
            <Link to="/"><Button variant="ghost" className="w-full">Back to Home</Button></Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Book a Meeting</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {lead ? `Booking for ${lead.firstName} ${lead.lastName}` : "Choose a meeting type and a time that works for you."}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-card rounded-xl border border-border p-5 space-y-4 h-fit">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm">Sarah Johnson</p>
                <p className="text-xs text-muted-foreground">Sales Manager</p>
              </div>
            </div>
            {selectedType && (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{selectedType.duration} minutes</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Video className="h-4 w-4" />
                  <span>Google Meet</span>
                </div>
                {selectedDate && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(selectedDate)}</span>
                  </div>
                )}
                {selectedSlot && (
                  <div className="flex items-center gap-2 text-foreground font-medium">
                    <Clock className="h-4 w-4 text-primary" />
                    <span>{selectedSlot} EST</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="md:col-span-2 bg-card rounded-xl border border-border p-5">
            {step === 0 && (
              <div>
                <h2 className="font-semibold mb-4">Select meeting type</h2>
                <div className="space-y-3">
                  {MEETING_TYPES.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => { setSelectedType(type); setStep(1); }}
                      className="w-full text-left p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{type.label}</p>
                          <p className="text-xs text-muted-foreground">{type.duration} minute meeting</p>
                        </div>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">{type.duration}m</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 1 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <button type="button" onClick={() => setStep(0)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <ChevronLeft className="h-4 w-4" /> Back
                  </button>
                  <h2 className="font-semibold">Select a date</h2>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekOffset((w) => Math.max(0, w - 1))} aria-label="Previous week">
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekOffset((w) => w + 1)} aria-label="Next week">
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1.5 mb-6">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                    <div key={d} className="text-center text-xs text-muted-foreground font-medium py-1">{d}</div>
                  ))}
                  {daysInView.map((day) => {
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        disabled={isWeekend}
                        onClick={() => { setSelectedDate(day); setStep(2); }}
                        className={cn(
                          "h-9 w-full rounded-lg text-sm font-medium transition-all",
                          isSelected ? "bg-primary text-white" :
                          isWeekend ? "opacity-30 cursor-not-allowed text-muted-foreground" :
                          "hover:bg-primary/10 text-foreground border border-transparent hover:border-primary/30"
                        )}
                      >
                        {format(day, "d")}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 2 && selectedDate && (
              <div>
                <button type="button" onClick={() => setStep(1)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <h2 className="font-semibold mb-4">Available slots — {formatDate(selectedDate)}</h2>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {slots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => { setSelectedSlot(slot); setStep(3); }}
                      className={cn(
                        "py-2.5 rounded-lg text-sm font-medium border transition-all",
                        selectedSlot === slot ? "bg-primary text-white border-primary" :
                        "border-border hover:border-primary hover:bg-primary/5 text-foreground"
                      )}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <form onSubmit={handleConfirm}>
                <button type="button" onClick={() => setStep(2)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <h2 className="font-semibold mb-4">Your information</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input id="firstName" {...form.register("firstName")} />
                      {form.formState.errors.firstName && (
                        <p className="text-xs text-destructive">{form.formState.errors.firstName.message}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input id="lastName" {...form.register("lastName")} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email *</Label>
                    <Input id="email" type="email" {...form.register("email")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="company">Company</Label>
                    <Input id="company" {...form.register("company")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="notes">Notes</Label>
                    <Input id="notes" {...form.register("notes")} placeholder="Anything we should know?" />
                  </div>
                  <Button className="w-full" type="submit" disabled={loading}>
                    {loading ? "Confirming..." : "Confirm Booking"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
