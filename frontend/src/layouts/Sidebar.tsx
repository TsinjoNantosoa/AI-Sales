import { Link, useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Users, GitBranch, MessageSquare, CalendarDays,
  ListChecks, Workflow, BarChart3, Bell, ScrollText, Plug, Settings,
  ChevronLeft, ChevronRight, LogOut, Globe, Sun, Moon,
  UserCircle, UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useAppStore } from "@/stores/appStore";
import { useTheme } from "next-themes";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/common/Avatar";
import { BrandLogo } from "@/components/common/BrandLogo";
import { useNotifications } from "@/hooks/useNotifications";
import { useTranslation } from "@/hooks/useTranslation";
import type { UserRole } from "@/types";

interface NavItem {
  to: string;
  icon: LucideIcon;
  labelKey: string;
  badge?: boolean;
  /** Roles allowed to see this item. Omit = all authenticated roles. */
  roles?: UserRole[];
}

interface NavGroup {
  groupKey: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    groupKey: "nav.overview",
    items: [
      { to: "/app/dashboard", icon: LayoutDashboard, labelKey: "nav.dashboard" },
      { to: "/app/leads", icon: Users, labelKey: "nav.leads" },
      { to: "/app/pipeline", icon: GitBranch, labelKey: "nav.pipeline" },
      { to: "/app/conversations", icon: MessageSquare, labelKey: "nav.conversations" },
      { to: "/app/appointments", icon: CalendarDays, labelKey: "nav.appointments" },
      { to: "/app/tasks", icon: ListChecks, labelKey: "nav.tasks" },
      {
        to: "/app/automations",
        icon: Workflow,
        labelKey: "nav.automations",
        roles: ["ADMIN", "SALES_MANAGER"],
      },
      {
        to: "/app/analytics",
        icon: BarChart3,
        labelKey: "nav.analytics",
        roles: ["ADMIN", "SALES_MANAGER"],
      },
    ],
  },
  {
    groupKey: "nav.management",
    items: [
      {
        to: "/app/team",
        icon: UsersRound,
        labelKey: "nav.team",
        roles: ["ADMIN", "SALES_MANAGER"],
      },
      { to: "/app/notifications", icon: Bell, labelKey: "nav.notifications", badge: true },
      {
        to: "/app/audit-logs",
        icon: ScrollText,
        labelKey: "nav.auditLogs",
        roles: ["ADMIN"],
      },
    ],
  },
  {
    groupKey: "nav.configuration",
    items: [
      {
        to: "/app/integrations",
        icon: Plug,
        labelKey: "nav.integrations",
        roles: ["ADMIN", "SALES_MANAGER"],
      },
      {
        to: "/app/settings",
        icon: Settings,
        labelKey: "nav.settings",
        roles: ["ADMIN"],
      },
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
  const { t } = useTranslation();

  const collapsed = !mobile && sidebarCollapsed;

  const canSee = (item: NavItem) => {
    if (!item.roles) return true;
    if (!user) return false;
    return item.roles.includes(user.role);
  };

  const canSeeSettings = user?.role === "ADMIN";

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
      <div
        className={cn(
          "flex border-b shrink-0",
          "border-[hsl(var(--sidebar-border))]",
          collapsed
            ? "flex-col items-center justify-center gap-1 px-1 py-2.5"
            : "items-center gap-1 h-16 px-2.5",
        )}
      >
        <div className={cn("min-w-0", collapsed ? "" : "flex-1")}>
          <BrandLogo
            variant={collapsed ? "mark" : "full"}
            size="md"
            className={cn(!collapsed && "w-[188px] max-w-[188px]")}
          />
        </div>
        {!mobile && (
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "h-6 w-6 rounded-md flex items-center justify-center shrink-0",
              "text-[hsl(215_20%_40%)] hover:text-white hover:bg-[hsl(var(--sidebar-hover-bg))]",
              "transition-colors"
            )}
          >
            {collapsed
              ? <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              : <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            }
          </button>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {NAV.map((group) => {
          const visibleItems = group.items.filter(canSee);
          if (!visibleItems.length) return null;
          const groupLabel = t(group.groupKey);
          return (
            <div key={group.groupKey} className="mb-2">
              {!collapsed && (
                <p className="sidebar-group-label px-3 mb-1.5">{groupLabel}</p>
              )}
              {collapsed && <div className="border-t border-[hsl(var(--sidebar-border))] mb-2 mx-1" />}
              <ul className="space-y-0.5">
                {visibleItems.map((item) => {
                  const label = t(item.labelKey);
                  const isActive =
                    location.pathname === item.to ||
                    (item.to !== "/app/dashboard" && location.pathname.startsWith(item.to + "/")) ||
                    (item.to === "/app/dashboard" && location.pathname === "/app/dashboard");
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        onClick={handleClick}
                        title={collapsed ? label : undefined}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "sidebar-item flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium",
                          "transition-colors duration-150 relative group",
                          collapsed && "justify-center px-2",
                          isActive ? "sidebar-item active" : ""
                        )}
                      >
                        <span aria-hidden="true" className="inline-flex">
                          <item.icon className="h-[18px] w-[18px] shrink-0" />
                        </span>

                        {!collapsed && (
                          <span className={cn("truncate flex-1", isActive ? "text-white" : "")}>
                            {label}
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
                            {label}
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
                  type="button"
                  onClick={() => setLanguage(lang)}
                  aria-pressed={language === lang}
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
          type="button"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className={cn(
            "sidebar-item w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm",
            "transition-colors",
            collapsed && "justify-center px-2"
          )}
          aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
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
              {canSeeSettings && (
                <DropdownMenuItem asChild>
                  <Link to="/app/settings" onClick={handleClick}>
                    <Settings className="h-4 w-4 mr-2" />Settings
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                onClick={() => {
                  void logout().finally(() => {
                    window.location.href = "/login";
                  });
                }}
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
