import { useNotifications } from "@/hooks/useNotifications";
import { Bell, Users, Calendar, CheckSquare, Workflow, Settings, Trash2, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, timeAgo } from "@/lib/utils";
import type { NotificationCategory } from "@/types";
import { EmptyState } from "@/components/common/EmptyState";
import { useTranslation } from "@/hooks/useTranslation";

const CATEGORY_ICONS: Record<NotificationCategory, typeof Bell> = {
  leads: Users,
  meetings: Calendar,
  tasks: CheckSquare,
  automations: Workflow,
  system: Settings,
};

const CATEGORY_COLORS: Record<NotificationCategory, string> = {
  leads: "bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
  meetings: "bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400",
  tasks: "bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400",
  automations: "bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
  system: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export function NotificationsPage() {
  const { t } = useTranslation();
  const { notifications, markRead, markAllRead, deleteNotification } = useNotifications();

  const categories: (NotificationCategory | "all")[] = ["all", "leads", "meetings", "tasks", "automations", "system"];
  const unreadCount = notifications.filter((n) => !n.read).length;

  const getFiltered = (cat: NotificationCategory | "all") =>
    cat === "all" ? notifications : notifications.filter((n) => n.category === cat);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("pages.notifications.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("pages.notifications.subtitle", { count: unreadCount })}</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" className="gap-2" onClick={() => markAllRead.mutate()}>
            <CheckCheck className="h-4 w-4" /> Mark all as read
          </Button>
        )}
      </div>

      <Tabs defaultValue="all">
        <TabsList className="mb-4 flex-wrap h-auto">
          {categories.map((cat) => {
            const count = cat === "all" ? notifications.filter((n) => !n.read).length : notifications.filter((n) => n.category === cat && !n.read).length;
            return (
              <TabsTrigger key={cat} value={cat} className="capitalize gap-1.5">
                {cat}
                {count > 0 && <span className="h-4 min-w-[16px] bg-primary rounded-full text-[10px] font-bold text-white flex items-center justify-center px-0.5">{count}</span>}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {categories.map((cat) => (
          <TabsContent key={cat} value={cat}>
            <div className="space-y-2">
              {getFiltered(cat).length === 0 ? (
                <EmptyState icon={Bell} title={t("empty.notifications")} />
              ) : getFiltered(cat).map((notif) => {
                const Icon = CATEGORY_ICONS[notif.category];
                return (
                  <div
                    key={notif.id}
                    className={cn(
                      "flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer hover:shadow-sm",
                      notif.read ? "bg-card border-border" : "bg-primary/5 border-primary/20",
                    )}
                    onClick={() => !notif.read && markRead.mutate(notif.id)}
                  >
                    <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", CATEGORY_COLORS[notif.category])}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn("text-sm", notif.read ? "text-foreground" : "font-semibold text-foreground")}>{notif.title}</p>
                        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{timeAgo(notif.createdAt)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{notif.message}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!notif.read && <div className="h-2 w-2 rounded-full bg-primary" />}
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 hover:opacity-100" onClick={(e) => { e.stopPropagation(); deleteNotification.mutate(notif.id); }}>
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
