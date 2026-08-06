import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Plus, Search, Download, Upload, Trash2, Edit, Eye,
  UserPlus, StickyNote, Calendar, Archive, MoreHorizontal, X, Users,
  ChevronUp, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusBadge, TemperatureBadge } from "@/components/common/StatusBadge";
import { ScoreIndicator } from "@/components/common/ScoreIndicator";
import { UserAvatar } from "@/components/common/Avatar";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { LeadFormModal } from "@/components/leads/LeadFormModal";
import { leadService } from "@/services/leadService";
import { teamService } from "@/services/teamService";
import { queryKeys } from "@/lib/queryKeys";
import { useAuthStore } from "@/stores/authStore";
import type { Lead, LeadStatus, LeadTemperature } from "@/types";
import { formatCurrency, timeAgo, cn } from "@/lib/utils";
import { toast } from "sonner";

type SortField = "score" | "createdAt" | "estimatedValue" | "firstName";
type SortDir = "asc" | "desc";

export function LeadsPage() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const importRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<LeadStatus | "all">("all");
  const [filterTemp, setFilterTemp] = useState<LeadTemperature | "all">("all");
  const [filterSource, setFilterSource] = useState("all");
  const [filterUser, setFilterUser] = useState("all");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkAssignUserId, setBulkAssignUserId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  const roleOpts = { currentUserId: user?.id, role: user?.role };

  const { data: leads = [], isLoading } = useQuery({
    queryKey: [...queryKeys.leads.all, user?.id, user?.role],
    queryFn: () => leadService.getLeads(roleOpts),
  });

  const { data: users = [] } = useQuery({
    queryKey: queryKeys.team.all,
    queryFn: () => teamService.getUsers(),
  });

  const invalidateLeads = () => {
    qc.invalidateQueries({ queryKey: queryKeys.leads.all });
    qc.invalidateQueries({ queryKey: queryKeys.dashboard.overview });
  };

  const deleteMutation = useMutation({
    mutationFn: leadService.deleteLead,
    onSuccess: () => { invalidateLeads(); toast.success("Lead deleted successfully."); },
    onError: () => toast.error("Failed to delete lead."),
  });

  const archiveMutation = useMutation({
    mutationFn: leadService.archiveLead,
    onSuccess: () => { invalidateLeads(); toast.success("Lead archived."); },
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) => leadService.assignLead(id, userId),
    onSuccess: () => { invalidateLeads(); toast.success("Lead assigned."); },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => leadService.bulkDelete(ids),
    onSuccess: () => {
      invalidateLeads();
      setSelectedIds([]);
      toast.success("Selected leads deleted.");
    },
  });

  const bulkAssignMutation = useMutation({
    mutationFn: ({ ids, userId }: { ids: string[]; userId: string }) =>
      leadService.bulkUpdate(ids, { assignedUserId: userId }),
    onSuccess: () => {
      invalidateLeads();
      setSelectedIds([]);
      setBulkAssignUserId("");
      toast.success("Leads assigned.");
    },
  });

  const importMutation = useMutation({
    mutationFn: leadService.importLeads,
    onSuccess: (result) => {
      invalidateLeads();
      toast.success(`Imported ${result.imported.length} leads${result.rejected.length ? `, ${result.rejected.length} rejected` : ""}.`);
    },
    onError: () => toast.error("Import failed."),
  });

  const filteredLeads = useMemo(() => {
    const result = leads.filter((l) => {
      const q = `${l.firstName} ${l.lastName} ${l.companyName} ${l.email}`.toLowerCase();
      return (
        (!search || q.includes(search.toLowerCase())) &&
        (filterStatus === "all" || l.status === filterStatus) &&
        (filterTemp === "all" || l.temperature === filterTemp) &&
        (filterSource === "all" || l.source === filterSource) &&
        (filterUser === "all" || l.assignedUserId === filterUser)
      );
    });
    result.sort((a, b) => {
      const av = a[sortField] as string | number, bv = b[sortField] as string | number;
      return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return result;
  }, [leads, search, filterStatus, filterTemp, filterSource, filterUser, sortField, sortDir]);

  const totalPages = Math.ceil(filteredLeads.length / PER_PAGE);
  const pagedLeads = filteredLeads.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const hasFilters = search || filterStatus !== "all" || filterTemp !== "all" || filterSource !== "all" || filterUser !== "all";

  const resetFilters = () => { setSearch(""); setFilterStatus("all"); setFilterTemp("all"); setFilterSource("all"); setFilterUser("all"); setPage(1); };
  const toggleSelect = (id: string) => setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleAll = () => setSelectedIds(selectedIds.length === pagedLeads.length ? [] : pagedLeads.map((l) => l.id));
  const getUserName = (id?: string) => { const u = users.find((u) => u.id === id); return u ? `${u.firstName} ${u.lastName}` : "—"; };
  const statuses: LeadStatus[] = ["NEW","CONTACTED","QUALIFYING","QUALIFIED","MEETING_SCHEDULED","PROPOSAL_SENT","NEGOTIATION","WON","LOST","INACTIVE"];
  const temps: LeadTemperature[] = ["HOT","WARM","COLD"];
  const salesUsers = users.filter((u) => u.role !== "ADMIN");

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const handleExport = () => {
    const header = "firstName,lastName,companyName,email,phone,status,score,source,estimatedValue";
    const rows = filteredLeads.map((l) =>
      [l.firstName, l.lastName, l.companyName, l.email, l.phone ?? "", l.status, l.score, l.source, l.estimatedValue ?? ""].join(",")
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredLeads.length} leads.`);
  };

  const handleImportFile = async (file: File) => {
    const text = await file.text();
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) {
      toast.error("CSV must include a header and at least one row.");
      return;
    }
    const headers = lines[0].split(",").map((h) => h.trim());
    const rows = lines.slice(1).map((line) => {
      const cols = line.split(",");
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = (cols[i] ?? "").trim(); });
      return {
        firstName: obj.firstName || obj.firstname || "",
        lastName: obj.lastName || obj.lastname || "",
        companyName: obj.companyName || obj.company || "",
        email: obj.email || "",
        phone: obj.phone,
        country: obj.country || "Unknown",
        serviceInterest: obj.serviceInterest || "Other",
        needDescription: obj.needDescription || "Imported via CSV",
        source: (obj.source as Lead["source"]) || "Manual",
      };
    });
    importMutation.mutate(rows);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  return (
    <div className="page-wrapper">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Leads</h1>
          <p className="page-subtitle">{filteredLeads.length} leads{hasFilters ? " (filtered)" : ""}</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <input
            ref={importRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
              e.target.value = "";
            }}
          />
          <Button variant="outline" size="sm" className="hidden sm:flex gap-1.5 h-9" onClick={() => importRef.current?.click()}>
            <Upload className="h-4 w-4" /> Import
          </Button>
          <Button variant="outline" size="sm" className="hidden sm:flex gap-1.5 h-9" onClick={handleExport}>
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button size="sm" className="gap-1.5 h-9" onClick={() => { setEditLead(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" /> Add Lead
          </Button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search leads…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 h-9 text-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v as LeadStatus | "all"); setPage(1); }}>
          <SelectTrigger className="h-9 w-[130px] text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statuses.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterTemp} onValueChange={(v) => { setFilterTemp(v as LeadTemperature | "all"); setPage(1); }}>
          <SelectTrigger className="h-9 w-[110px] text-sm"><SelectValue placeholder="Temp" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Temps</SelectItem>
            {temps.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterUser} onValueChange={(v) => { setFilterUser(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[130px] text-sm hidden sm:flex"><SelectValue placeholder="Assignee" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sales</SelectItem>
            {salesUsers.map((u) => <SelectItem key={u.id} value={u.id}>{u.firstName}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-9 gap-1 text-muted-foreground hover:text-foreground" onClick={resetFilters}>
            <X className="h-3.5 w-3.5" /> Reset
          </Button>
        )}
      </div>

      {/* ── Bulk Actions ── */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 bg-primary/5 rounded-lg border border-primary/20 animate-fade-in-up">
          <span className="text-sm font-semibold text-primary">{selectedIds.length} selected</span>
          <Select value={bulkAssignUserId} onValueChange={setBulkAssignUserId}>
            <SelectTrigger className="h-7 w-[140px] text-xs"><SelectValue placeholder="Assign to…" /></SelectTrigger>
            <SelectContent>
              {salesUsers.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            disabled={!bulkAssignUserId || bulkAssignMutation.isPending}
            onClick={() => bulkAssignMutation.mutate({ ids: selectedIds, userId: bulkAssignUserId })}
          >
            <UserPlus className="h-3 w-3" /> Assign
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash2 className="h-3 w-3" /> Delete
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs ml-auto" onClick={() => setSelectedIds([])}>Clear</Button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="table-container">
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-3 sm:px-4 py-3 text-left w-10">
                  <Checkbox checked={selectedIds.length === pagedLeads.length && pagedLeads.length > 0} onCheckedChange={toggleAll} />
                </th>
                <th className="px-3 sm:px-4 py-3 text-left">
                  <button className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors" onClick={() => handleSort("firstName")}>
                    Lead <SortIcon field="firstName" />
                  </button>
                </th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-muted-foreground hidden lg:table-cell">Source</th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-muted-foreground hidden xl:table-cell">Service</th>
                <th className="px-3 sm:px-4 py-3 text-left">
                  <button className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors" onClick={() => handleSort("score")}>
                    Score <SortIcon field="score" />
                  </button>
                </th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-muted-foreground hidden sm:table-cell">Temp.</th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-muted-foreground hidden md:table-cell">Assigned</th>
                <th className="px-3 sm:px-4 py-3 text-left">
                  <button className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors hidden sm:flex" onClick={() => handleSort("estimatedValue")}>
                    Value <SortIcon field="estimatedValue" />
                  </button>
                </th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-muted-foreground hidden lg:table-cell">Activity</th>
                <th className="px-3 sm:px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: 11 }).map((_, j) => (
                      <td key={j} className="px-3 sm:px-4 py-3">
                        <div className="h-4 bg-muted rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : pagedLeads.length === 0 ? (
                <tr>
                  <td colSpan={11}>
                    <EmptyState
                      icon={Users}
                      title="No leads found"
                      description={hasFilters ? "Try adjusting your filters." : "Add your first lead to get started."}
                      action={hasFilters
                        ? { label: "Reset filters", onClick: resetFilters }
                        : { label: "Add Lead", onClick: () => setFormOpen(true) }
                      }
                    />
                  </td>
                </tr>
              ) : pagedLeads.map((lead) => (
                <tr
                  key={lead.id}
                  className={cn(
                    "border-b border-border hover:bg-muted/30 transition-colors",
                    selectedIds.includes(lead.id) && "bg-primary/5"
                  )}
                >
                  <td className="px-3 sm:px-4 py-3">
                    <Checkbox checked={selectedIds.includes(lead.id)} onCheckedChange={() => toggleSelect(lead.id)} />
                  </td>
                  <td className="px-3 sm:px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <UserAvatar firstName={lead.firstName} lastName={lead.lastName} id={lead.id} size="sm" />
                      <div className="min-w-0">
                        <Link
                          to={`/app/leads/${lead.id}`}
                          className="text-sm font-medium text-foreground hover:text-primary transition-colors truncate block max-w-[140px]"
                        >
                          {lead.firstName} {lead.lastName}
                        </Link>
                        <p className="text-xs text-muted-foreground truncate max-w-[140px]">{lead.companyName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 sm:px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-md">{lead.source}</span>
                  </td>
                  <td className="px-3 sm:px-4 py-3 hidden xl:table-cell">
                    <span className="text-xs text-muted-foreground max-w-[120px] truncate block">{lead.serviceInterest}</span>
                  </td>
                  <td className="px-3 sm:px-4 py-3">
                    <ScoreIndicator score={lead.score} showBar />
                  </td>
                  <td className="px-3 sm:px-4 py-3 hidden sm:table-cell">
                    <TemperatureBadge temp={lead.temperature} />
                  </td>
                  <td className="px-3 sm:px-4 py-3">
                    <StatusBadge status={lead.status} />
                  </td>
                  <td className="px-3 sm:px-4 py-3 hidden md:table-cell">
                    {lead.assignedUserId ? (
                      <div className="flex items-center gap-1.5">
                        <UserAvatar
                          firstName={getUserName(lead.assignedUserId).split(" ")[0]}
                          lastName={getUserName(lead.assignedUserId).split(" ")[1] || ""}
                          id={lead.assignedUserId}
                          size="xs"
                        />
                        <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                          {getUserName(lead.assignedUserId).split(" ")[0]}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="px-3 sm:px-4 py-3 hidden sm:table-cell">
                    <span className="text-xs font-medium">
                      {lead.estimatedValue ? formatCurrency(lead.estimatedValue) : "—"}
                    </span>
                  </td>
                  <td className="px-3 sm:px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {lead.lastInteractionAt ? timeAgo(lead.lastInteractionAt) : "—"}
                    </span>
                  </td>
                  <td className="px-3 sm:px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem asChild>
                          <Link to={`/app/leads/${lead.id}`}><Eye className="h-4 w-4 mr-2" />View Profile</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setEditLead(lead); setFormOpen(true); }}>
                          <Edit className="h-4 w-4 mr-2" />Edit
                        </DropdownMenuItem>
                        {salesUsers[0] && (
                          <DropdownMenuItem onClick={() => assignMutation.mutate({ id: lead.id, userId: salesUsers[0].id })}>
                            <UserPlus className="h-4 w-4 mr-2" />Assign
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem asChild>
                          <Link to={`/app/leads/${lead.id}`}><StickyNote className="h-4 w-4 mr-2" />Add Note</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/app/appointments"><Calendar className="h-4 w-4 mr-2" />Book Meeting</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => archiveMutation.mutate(lead.id)}>
                          <Archive className="h-4 w-4 mr-2" />Archive
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive focus:bg-destructive/10"
                          onClick={() => setDeleteId(lead.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border bg-muted/20">
            <p className="text-xs text-muted-foreground">
              {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filteredLeads.length)} of {filteredLeads.length} leads
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page === 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const p = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i;
                return (
                  <Button
                    key={p}
                    variant={page === p ? "default" : "outline"}
                    size="sm"
                    className="h-7 w-7 p-0 text-xs"
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </Button>
                );
              })}
              <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <LeadFormModal open={formOpen} onOpenChange={setFormOpen} lead={editLead} />
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Lead"
        description="This will permanently delete the lead and all associated data. This action cannot be undone."
        confirmLabel="Delete Lead"
        onConfirm={() => { if (deleteId) { deleteMutation.mutate(deleteId); setDeleteId(null); } }}
      />
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="Delete Selected Leads"
        description={`This will permanently delete ${selectedIds.length} leads. This action cannot be undone.`}
        confirmLabel="Delete Leads"
        onConfirm={() => { bulkDeleteMutation.mutate(selectedIds); setBulkDeleteOpen(false); }}
      />
    </div>
  );
}
