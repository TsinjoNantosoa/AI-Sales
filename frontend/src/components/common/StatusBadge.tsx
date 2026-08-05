import { cn, getStatusColor, getTemperatureColor, getPriorityColor } from "@/lib/utils";
import type { LeadStatus, LeadTemperature } from "@/types";

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
}

export function Badge({ children, className }: BadgeProps) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: LeadStatus }) {
  const labels: Record<LeadStatus, string> = {
    NEW: "New",
    CONTACTED: "Contacted",
    QUALIFYING: "Qualifying",
    QUALIFIED: "Qualified",
    MEETING_SCHEDULED: "Meeting Scheduled",
    PROPOSAL_SENT: "Proposal Sent",
    NEGOTIATION: "Negotiation",
    WON: "Won",
    LOST: "Lost",
    INACTIVE: "Inactive",
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", getStatusColor(status))}>
      {labels[status]}
    </span>
  );
}

export function TemperatureBadge({ temp }: { temp: LeadTemperature }) {
  const icons = { HOT: "🔥", WARM: "☀️", COLD: "❄️" };
  const labels = { HOT: "Hot", WARM: "Warm", COLD: "Cold" };
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border", getTemperatureColor(temp))}>
      <span>{icons[temp]}</span>
      {labels[temp]}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", getPriorityColor(priority))}>
      {priority}
    </span>
  );
}
