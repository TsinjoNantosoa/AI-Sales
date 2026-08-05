import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, GitBranch, MessageSquare, Calendar,
  CheckSquare, Zap, BarChart3, Bell, Shield, Puzzle, Settings,
  ChevronLeft, ChevronRight, Bot, LogOut, Globe, Sun, Moon,
  UserCircle, Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useAppStore } from "@/stores/appStore";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/common/Avatar";
import { useNotifications } from "@/hooks/useNotifications";

interface NavItem {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: boolean;
  adminOnly?: boolean;
  managerUp?: boolean;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    group: "Overview",
    items: [
      { to: "/app/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { to: "/app/leads", icon: Users, label: "Leads" },
      { to: "/app/pipeline", icon: GitBranch, label: "Pipeline" },
      { to: "/app/conversations", icon: MessageSquare, label: "Conversations" },
      { to: "/app/appointments", icon: Calendar, label: "Appointments" },
      { to: "/app/tasks", icon: CheckSquare, label: "Tasks" },
      { to: "/app/automations", icon: Zap, label: "Automations" },
      { to: "/app/analytics", icon: BarChart3, label: "Analytics" },
    ],
  },
  {
    group: "Management",
    items: [
      { to: "/app/team", icon: Building2, label: "Team", managerUp: true },
      { to: "/app/notifications", icon: Bell, label: "Notifications", badge: true },
      { to: "/app/audit-logs", icon: Shield, label: "Audit Logs", adminOnly: true },
    ],
  },
  {
    group: "Configuration",
    items: [
      { to: "/app/integrations", icon: Puzzle, label: "Integrations" },
      { to: "/app/settings", icon: Settings, label: "Settings" },
    ],
  },
];

interface SidebarProps {
  mobile?: boolean;
  onClose?: () => void;
}

export function Sidebar({ mobile = false, onClose }: SidebarProps) {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { language, setLanguage, sidebarCollapsed, toggleSidebar } = useAppStore();
  const { resolvedTheme, setTheme } = useTheme();
  const { unreadCount } = useNotifications();

  const collapsed = !mobile && sidebarCollapsed;

  const canSee = (item: NavItem) => {
    if (item.adminOnly && user?.role !== "ADMIN") return false;
    if (item.managerUp && user?.role === "SALES_REPRESENTATIVE") return false;
    return true;
  };

  const handleClick = () => {
    if (mobile && onClose) onClose();
  };

  return (
    <aside
      className={cn(
        "sidebar flex flex-col h-full transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* ── Logo ── */}
      <div className={cn(
        "flex items-center gap-3 h-16 px-4 border-b shrink-0",
        "border-[hsl(var(--sidebar-border))]",
        collapsed && "justify-center px-2"
      )}>
        <div className="h-8 w-8 rounded-lg bg-blue-500 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/30">
          <Bot className="h-4 w-4 text-white" />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate leading-none">AI Sales</p>
            <p className="text-[11px] text-[hsl(215_20%_50%)] truncate mt-0.5">Assistant</p>
          </div>
        )}
        {!mobile && (
          <button
            onClick={toggleSidebar}
            className={cn(
              "h-6 w-6 rounded-md flex items-center justify-center shrink-0",
              "text-[hsl(215_20%_40%)] hover:text-white hover:bg-[hsl(var(--sidebar-hover-bg))]",
              "transition-colors"
            )}
          >
            {collapsed
              ? <ChevronRight className="h-3.5 w-3.5" />
              : <ChevronLeft className="h-3.5 w-3.5" />
            }
          </button>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {NAV.map((group) => {
          const visibleItems = group.items.filter(canSee);
          if (!visibleItems.length) return null;
          return (
            <div key={group.group} className="mb-2">
              {!collapsed && (
                <p className="sidebar-group-label px-3 mb-1.5">{group.group}</p>
              )}
              {collapsed && <div className="border-t border-[hsl(var(--sidebar-border))] mb-2 mx-1" />}
              <ul className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive =
                    location.pathname === item.to ||
                    (item.to !== "/app/dashboard" && location.pathname.startsWith(item.to + "/")) ||
                    (item.to === "/app/dashboard" && location.pathname === "/app/dashboard");
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        onClick={handleClick}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "sidebar-item flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium",
                          "transition-all duration-150 relative group",
                          collapsed && "justify-center px-2",
                          isActive ? "sidebar-item active" : ""
                        )}
                      >
                        <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "")} />

                        {!collapsed && (
                          <span className={cn("truncate flex-1", isActive ? "text-white" : "")}>
                            {item.label}
                          </span>
                        )}

                        {/* Badge */}
                        {item.badge && unreadCount > 0 && (
                          collapsed ? (
                            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 ring-1 ring-[hsl(var(--sidebar-bg))]" />
                          ) : (
                            <span className={cn(
                              "ml-auto min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center",
                              "text-[10px] font-bold",
                              isActive ? "bg-white/20 text-white" : "bg-blue-500 text-white"
                            )}>
                              {unreadCount > 9 ? "9+" : unreadCount}
                            </span>
                          )
                        )}

                        {/* Tooltip on collapsed */}
                        {collapsed && (
                          <span className={cn(
                            "absolute left-full ml-2 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap",
                            "bg-[hsl(222_47%_20%)] text-white shadow-lg",
                            "opacity-0 pointer-events-none group-hover:opacity-100",
                            "transition-opacity z-50"
                          )}>
                            {item.label}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* ── Footer ── */}
      <div className="border-t border-[hsl(var(--sidebar-border))] p-2 space-y-1">
        {/* Language */}
        {!collapsed && (
          <div className="flex items-center gap-1 px-3 py-1">
            <Globe className="h-3.5 w-3.5 text-[hsl(215_20%_45%)] shrink-0" />
            <div className="flex items-center gap-0.5">
              {(["en", "fr"] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={cn(
                    "text-[11px] font-semibold px-1.5 py-0.5 rounded transition-colors uppercase",
                    language === lang
                      ? "text-white bg-blue-500/20"
                      : "text-[hsl(215_20%_40%)] hover:text-white"
                  )}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Theme */}
        <button
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className={cn(
            "sidebar-item w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm",
            "transition-colors",
            collapsed && "justify-center px-2"
          )}
          title={collapsed ? (resolvedTheme === "dark" ? "Light Mode" : "Dark Mode") : undefined}
        >
          {resolvedTheme === "dark"
            ? <Sun className="h-4 w-4 shrink-0" />
            : <Moon className="h-4 w-4 shrink-0" />
          }
          {!collapsed && (
            <span>{resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}</span>
          )}
        </button>

        {/* User */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                "sidebar-item w-full flex items-center gap-3 px-3 py-2 rounded-lg",
                "transition-colors",
                collapsed && "justify-center px-2"
              )}>
                <UserAvatar firstName={user.firstName} lastName={user.lastName} id={user.id} size="sm" />
                {!collapsed && (
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-xs font-semibold text-white truncate">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-[10px] text-[hsl(215_20%_45%)] truncate">
                      {user.role === "ADMIN" ? "Admin" : user.role === "SALES_MANAGER" ? "Manager" : "Sales Rep"}
                    </p>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={collapsed ? "start" : "end"} side="top" className="w-52">
              <div className="px-3 py-2 border-b border-border">
                <p className="text-sm font-semibold">{user.firstName} {user.lastName}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <DropdownMenuItem asChild>
                <Link to="/app/profile" onClick={handleClick}>
                  <UserCircle className="h-4 w-4 mr-2" />Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/app/settings" onClick={handleClick}>
                  <Settings className="h-4 w-4 mr-2" />Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                onClick={() => { logout(); window.location.href = "/login"; }}
              >
                <LogOut className="h-4 w-4 mr-2" />Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </aside>
  );
}
