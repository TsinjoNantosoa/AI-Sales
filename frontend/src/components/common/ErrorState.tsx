import { AlertCircle, AlertTriangle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppIcon } from "@/components/ui/AppIcon";

type ErrorKind = "generic" | "auth" | "permission" | "notFound" | "network";

interface ErrorStateProps {
  kind?: ErrorKind;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

const KIND_ICON = {
  generic: AlertCircle,
  auth: ShieldAlert,
  permission: ShieldAlert,
  notFound: AlertTriangle,
  network: AlertTriangle,
} as const;

export function ErrorState({ kind = "generic", title, description, action }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <AppIcon icon={KIND_ICON[kind]} size="lg" tone="danger" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      {description && <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>}
      {action && (
        <Button variant="outline" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
