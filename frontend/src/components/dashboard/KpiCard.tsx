import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: LucideIcon;
  iconColor?: string;
  tooltip?: string;
}

export function KpiCard({ title, value, change, icon: Icon, iconColor = "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400", tooltip }: KpiCardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNeutral = change === 0;

  return (
    <div className="card-hover bg-card rounded-xl border border-border p-4 sm:p-5">
      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <div className={cn("h-9 w-9 sm:h-10 sm:w-10 rounded-lg flex items-center justify-center shrink-0", iconColor)}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" strokeWidth={1.75} />
        </div>
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground/50 cursor-help hover:text-muted-foreground transition-colors" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[180px] text-xs">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <p className="text-xl sm:text-2xl font-bold text-foreground mb-1 truncate">
        {value}
      </p>
      <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3 truncate">{title}</p>

      {change !== undefined && (
        <div className={cn(
          "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
          isNeutral
            ? "bg-muted text-muted-foreground"
            : isPositive
            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
            : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
        )}>
          {isNeutral
            ? <Minus className="h-3 w-3" />
            : isPositive
            ? <TrendingUp className="h-3 w-3" />
            : <TrendingDown className="h-3 w-3" />
          }
          <span>{isPositive ? "+" : ""}{change.toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}
