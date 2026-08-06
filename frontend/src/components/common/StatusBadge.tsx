import { cn, getStatusColor, getTemperatureColor, getPriorityColor } from "@/lib/utils";
import type { LeadStatus, LeadTemperature } from "@/types";
import { useTranslation } from "@/hooks/useTranslation";

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
  const { t } = useTranslation();
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", getStatusColor(status))}>
      {t(`status.${status}`)}
    </span>
  );
}

export function TemperatureBadge({ temp }: { temp: LeadTemperature }) {
  const { t } = useTranslation();
  const icons = { HOT: "🔥", WARM: "☀️", COLD: "❄️" };
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border", getTemperatureColor(temp))}>
      <span>{icons[temp]}</span>
      {t(`leads.temperature.${temp}`)}
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
