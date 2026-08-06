import { useState } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { Menu, Bell } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { Sidebar } from "./Sidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Toaster } from "sonner";
import { useNotifications } from "@/hooks/useNotifications";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const ROUTE_LABELS: Record<string, string> = {
  "/app/dashboard": "Dashboard",
  "/app/leads": "Leads",
  "/app/pipeline": "Pipeline",
  "/app/conversations": "Conversations",
  "/app/appointments": "Appointments",
  "/app/tasks": "Tasks",
  "/app/automations": "Automations",
  "/app/analytics": "Analytics",
  "/app/team": "Team",
  "/app/notifications": "Notifications",
  "/app/audit-logs": "Audit Logs",
  "/app/integrations": "Integrations",
  "/app/settings": "Settings",
  "/app/profile": "My Profile",
};

function getPageLabel(pathname: string): string {
  if (ROUTE_LABELS[pathname]) return ROUTE_LABELS[pathname];
  if (pathname.startsWith("/app/leads/")) return "Lead Detail";
  return "AI Sales Assistant";
}

export function AppLayout() {
  const { isAuthenticated, hasHydrated } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { unreadCount } = useNotifications();

  if (!hasHydrated) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const pageLabel = getPageLabel(location.pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-60 bg-[hsl(var(--sidebar-bg))] border-r border-[hsl(var(--sidebar-border))]">
          <Sidebar mobile onClose={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center gap-3 px-4 h-14 border-b border-border bg-card shrink-0 z-10">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="h-6 w-6 rounded-md bg-blue-500 flex items-center justify-center shrink-0">
              <span className="text-white text-[10px] font-bold">AI</span>
            </div>
            <h1 className="text-sm font-semibold text-foreground truncate">{pageLabel}</h1>
          </div>

          <Link to="/app/notifications" className="relative shrink-0">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className={cn(
                  "absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-0.5",
                  "rounded-full bg-red-500 text-white text-[9px] font-bold",
                  "flex items-center justify-center"
                )}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          </Link>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <Toaster position="top-right" richColors closeButton expand={false} />
    </div>
  );
}
