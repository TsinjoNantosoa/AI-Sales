import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ICONS, ICON_SIZE, type AppIconName, type IconSizeToken } from "@/lib/icons";

const TONE = {
  inherit: "text-current",
  muted: "text-muted-foreground",
  primary: "text-primary",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
  inverse: "text-white",
} as const;

export type AppIconTone = keyof typeof TONE;

interface AppIconProps {
  name?: AppIconName;
  icon?: LucideIcon;
  size?: IconSizeToken | number;
  strokeWidth?: number;
  className?: string;
  tone?: AppIconTone;
  disabled?: boolean;
  label?: string;
}

export function AppIcon({
  name,
  icon,
  size = "md",
  strokeWidth = 1.75,
  className,
  tone = "inherit",
  disabled = false,
  label,
}: AppIconProps) {
  const Icon = icon ?? (name ? ICONS[name] : undefined);
  if (!Icon) return null;

  const px = typeof size === "number" ? size : ICON_SIZE[size];
  const decorative = !label;

  return (
    <Icon
      width={px}
      height={px}
      strokeWidth={strokeWidth}
      className={cn("shrink-0", TONE[tone], disabled && "opacity-40", className)}
      aria-hidden={decorative || undefined}
      aria-label={label}
      role={label ? "img" : undefined}
    />
  );
}
