import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter, useDroppable, useDraggable } from "@dnd-kit/core";
import { Link } from "react-router-dom";
import { Plus, List, Columns } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TemperatureBadge } from "@/components/common/StatusBadge";
import { ScoreIndicator } from "@/components/common/ScoreIndicator";
import { UserAvatar } from "@/components/common/Avatar";
import { LeadFormModal } from "@/components/leads/LeadFormModal";
import { leadService } from "@/services/leadService";
import { teamService } from "@/services/teamService";
import { queryKeys } from "@/lib/queryKeys";
import { useAuthStore } from "@/stores/authStore";
import type { Lead, LeadStatus, User } from "@/types";
import { formatCurrency, timeAgo, cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/useTranslation";

const COLUMNS: { id: LeadStatus; colorBar: string; colorText: string }[] = [
  { id: "NEW", colorBar: "bg-slate-400", colorText: "text-slate-600 dark:text-slate-400" },
  { id: "CONTACTED", colorBar: "bg-blue-500", colorText: "text-blue-600 dark:text-blue-400" },
  { id: "QUALIFYING", colorBar: "bg-yellow-500", colorText: "text-yellow-600 dark:text-yellow-400" },
  { id: "QUALIFIED", colorBar: "bg-green-500", colorText: "text-green-600 dark:text-green-400" },
  { id: "MEETING_SCHEDULED", colorBar: "bg-purple-500", colorText: "text-purple-600 dark:text-purple-400" },
  { id: "PROPOSAL_SENT", colorBar: "bg-indigo-500", colorText: "text-indigo-600 dark:text-indigo-400" },
  { id: "NEGOTIATION", colorBar: "bg-orange-500", colorText: "text-orange-600 dark:text-orange-400" },
  { id: "WON", colorBar: "bg-emerald-500", colorText: "text-emerald-600 dark:text-emerald-400" },
  { id: "LOST", colorBar: "bg-red-500", colorText: "text-red-600 dark:text-red-400" },
];

function DroppableColumn({ col, children, count, value }: {
  col: typeof COLUMNS[0]; children: React.ReactNode; count: number; value: number;
}) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  return (
    <div className="flex flex-col w-[256px] flex-shrink-0">
      <div className={cn("flex items-center justify-between px-3 py-2 mb-2 rounded-lg bg-muted/50 border border-border border-t-2", col.colorBar.replace("bg-", "border-t-"))}>
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-bold", col.colorText)}>{t(`status.${col.id}`)}</span>
          <span className="h-5 min-w-[20px] px-1 bg-background rounded-full flex items-center justify-center text-[10px] font-bold text-muted-foreground border border-border">{count}</span>
        </div>
        <span className="text-[10px] text-muted-foreground font-medium">{formatCurrency(value)}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 min-h-[420px] space-y-2 p-2 rounded-xl border-2 border-dashed transition-all duration-150",
          isOver ? "border-primary/50 bg-primary/5" : "border-transparent bg-muted/10"
        )}
      >
        {children}
      </div>
    </div>
  );
}

function KanbanCard({ lead, users }: { lead: Lead; users: User[] }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const assignedUser = users.find((u) => u.id === lead.assignedUserId);
  const style = transform ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)` } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "bg-card rounded-xl border border-border p-3 cursor-grab active:cursor-grabbing",
        "hover:shadow-md hover:border-primary/30 transition-all duration-150 group",
        isDragging && "opacity-50 shadow-2xl rotate-1 scale-105"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <Link
            to={`/app/leads/${lead.id}`}
            className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate block leading-tight"
            onClick={(e) => e.stopPropagation()}
          >
            {lead.firstName} {lead.lastName}
          </Link>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{lead.companyName}</p>
        </div>
        <TemperatureBadge temp={lead.temperature} />
      </div>

      <div className="flex items-center justify-between mb-2">
        <ScoreIndicator score={lead.score} showBar />
        {lead.estimatedValue && (
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(lead.estimatedValue)}
          </span>
        )}
      </div>

      {lead.serviceInterest && (
        <p className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md mb-2 truncate">
          {lead.serviceInterest}
        </p>
      )}

      <div className="flex items-center justify-between pt-1.5 border-t border-border/50">
        {assignedUser ? (
          <div className="flex items-center gap-1.5">
            <UserAvatar firstName={assignedUser.firstName} lastName={assignedUser.lastName} id={assignedUser.id} size="xs" />
            <span className="text-[10px] text-muted-foreground">{assignedUser.firstName}</span>
          </div>
        ) : <span className="text-[10px] text-muted-foreground/50">Unassigned</span>}
        {lead.lastInteractionAt && (
          <span className="text-[10px] text-muted-foreground">{timeAgo(lead.lastInteractionAt)}</span>
        )}
      </div>
    </div>
  );
}

function CardOverlay({ lead }: { lead: Lead }) {
  return (
    <div className="bg-card rounded-xl border border-primary shadow-2xl p-3 w-[240px] rotate-2 opacity-95">
      <p className="text-sm font-semibold">{lead.firstName} {lead.lastName}</p>
      <p className="text-xs text-muted-foreground">{lead.companyName}</p>
    </div>
  );
}

export function PipelinePage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [mobileColumn, setMobileColumn] = useState<LeadStatus>("NEW");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");

  const { data: leads = [], isLoading } = useQuery({
    queryKey: [...queryKeys.leads.all, user?.id, user?.role],
    queryFn: () =>
      leadService.getLeads({ currentUserId: user?.id, role: user?.role }),
  });

  const { data: users = [] } = useQuery({
    queryKey: queryKeys.team.all,
    queryFn: () => teamService.getUsers(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: LeadStatus }) =>
      leadService.moveLead(id, status),
    onSuccess: (lead) => {
      qc.invalidateQueries({ queryKey: queryKeys.leads.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.overview });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.pipeline });
      toast.success(t("toast.updated") + ` → ${t(`status.${lead.status}`)}`);
    },
  });

  const handleDragStart = (e: DragStartEvent) => {
    setActiveLead(leads.find((l) => l.id === e.active.id) ?? null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveLead(null);
    const { active, over } = e;
    if (!over) return;
    const lead = leads.find((l) => l.id === active.id);
    const newStatus = over.id as LeadStatus;
    if (lead && lead.status !== newStatus) {
      updateMutation.mutate({ id: lead.id, status: newStatus });
    }
  };

  const getColLeads = (s: LeadStatus) => leads.filter((l) => l.status === s);
  const getColValue = (s: LeadStatus) => leads.filter((l) => l.status === s).reduce((sum, l) => sum + (l.estimatedValue ?? 0), 0);
  const totalValue = leads.filter((l) => l.status !== "LOST").reduce((s, l) => s + (l.estimatedValue ?? 0), 0);
  const activeCount = leads.filter((l) => l.status !== "LOST" && l.status !== "WON").length;

  if (isLoading) return (
    <div className="page-wrapper">
      <div className="h-8 w-48 bg-muted rounded-lg animate-pulse mb-4" />
      <div className="flex gap-3 overflow-x-auto pb-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="w-[256px] flex-shrink-0 h-96 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 h-full flex flex-col gap-4">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("pages.pipeline.title")}</h1>
          <p className="page-subtitle">{t("pages.pipeline.subtitle", { count: activeCount, value: formatCurrency(totalValue) })}</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* View toggle — desktop */}
          <div className="hidden sm:flex items-center gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setViewMode("kanban")}
              className={cn("h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all", viewMode === "kanban" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <Columns className="h-3.5 w-3.5" /> Kanban
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn("h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all", viewMode === "list" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <List className="h-3.5 w-3.5" /> List
            </button>
          </div>
          <Button size="sm" className="gap-1.5 h-9" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> {t("buttons.addLead")}
          </Button>
        </div>
      </div>

      {/* ── Mobile column picker ── */}
      <div className="sm:hidden">
        <Select value={mobileColumn} onValueChange={(v) => setMobileColumn(v as LeadStatus)}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COLUMNS.map((col) => (
              <SelectItem key={col.id} value={col.id}>
                {t(`status.${col.id}`)} ({getColLeads(col.id).length})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Mobile: single column view ── */}
      <div className="sm:hidden flex-1 overflow-y-auto space-y-2">
        {getColLeads(mobileColumn).length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">No leads in this stage.</div>
        ) : getColLeads(mobileColumn).map((lead) => (
          <Link key={lead.id} to={`/app/leads/${lead.id}`}>
            <div className="bg-card rounded-xl border border-border p-3 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <UserAvatar firstName={lead.firstName} lastName={lead.lastName} id={lead.id} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{lead.firstName} {lead.lastName}</p>
                    <p className="text-xs text-muted-foreground truncate">{lead.companyName}</p>
                  </div>
                </div>
                <TemperatureBadge temp={lead.temperature} />
              </div>
              <div className="flex items-center justify-between">
                <ScoreIndicator score={lead.score} showBar />
                {lead.estimatedValue && <span className="text-xs font-bold text-emerald-600">{formatCurrency(lead.estimatedValue)}</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Desktop: Kanban or List ── */}
      <div className="hidden sm:flex flex-1 overflow-hidden">
        {viewMode === "kanban" ? (
          <div className="flex-1 overflow-x-auto">
            <DndContext collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div className="flex gap-3 min-w-max h-full pb-4">
                {COLUMNS.map((col) => {
                  const colLeads = getColLeads(col.id);
                  return (
                    <DroppableColumn key={col.id} col={col} count={colLeads.length} value={getColValue(col.id)}>
                      {colLeads.map((lead) => <KanbanCard key={lead.id} lead={lead} users={users} />)}
                    </DroppableColumn>
                  );
                })}
              </div>
              <DragOverlay>{activeLead && <CardOverlay lead={activeLead} />}</DragOverlay>
            </DndContext>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4">
            {COLUMNS.map((col) => {
              const colLeads = getColLeads(col.id);
              if (!colLeads.length) return null;
              return (
                <div key={col.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn("h-2 w-2 rounded-full", col.colorBar)} />
                    <h3 className={cn("text-xs font-bold uppercase tracking-wide", col.colorText)}>{t(`status.${col.id}`)}</h3>
                    <span className="text-xs text-muted-foreground">({colLeads.length})</span>
                    <span className="text-xs text-muted-foreground ml-auto">{formatCurrency(getColValue(col.id))}</span>
                  </div>
                  <div className="space-y-2">
                    {colLeads.map((lead) => (
                      <Link key={lead.id} to={`/app/leads/${lead.id}`} className="block">
                        <div className="bg-card border border-border rounded-xl p-3 hover:shadow-sm hover:border-primary/30 transition-all flex items-center gap-3">
                          <UserAvatar firstName={lead.firstName} lastName={lead.lastName} id={lead.id} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{lead.firstName} {lead.lastName}</p>
                            <p className="text-xs text-muted-foreground truncate">{lead.companyName}</p>
                          </div>
                          <div className="hidden md:flex items-center gap-3">
                            <ScoreIndicator score={lead.score} showBar />
                            <TemperatureBadge temp={lead.temperature} />
                            {lead.estimatedValue && (
                              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 w-20 text-right">
                                {formatCurrency(lead.estimatedValue)}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <LeadFormModal open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
