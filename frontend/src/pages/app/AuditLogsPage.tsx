import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Shield, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { auditService } from "@/services/auditService";
import { teamService } from "@/services/teamService";
import { queryKeys } from "@/lib/queryKeys";
import { PageLoader } from "@/components/common/LoadingSpinner";
import { cn, formatDateTime } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { Navigate } from "react-router-dom";

export function AuditLogsPage() {
  const { user } = useAuthStore();
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [filterUser, setFilterUser] = useState("all");
  const [filterResult, setFilterResult] = useState("all");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: queryKeys.audit.all,
    queryFn: () => auditService.getLogs(),
  });

  const { data: users = [] } = useQuery({
    queryKey: queryKeys.team.all,
    queryFn: () => teamService.getUsers(),
  });

  if (user?.role !== "ADMIN") return <Navigate to="/app/dashboard" replace />;
  if (isLoading) return <PageLoader />;

  const actions = [...new Set(logs.map((l) => l.action))];

  const filtered = logs.filter((log) => {
    const matchSearch = !search || `${log.userName} ${log.action} ${log.entity} ${log.details}`.toLowerCase().includes(search.toLowerCase());
    const matchAction = filterAction === "all" || log.action === filterAction;
    const matchUser = filterUser === "all" || log.userId === filterUser;
    const matchResult = filterResult === "all" || log.result === filterResult;
    return matchSearch && matchAction && matchUser && matchResult;
  });

  const getActionColor = (action: string) => {
    if (action.includes("DELETE") || action.includes("LOST")) return "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400";
    if (action.includes("LOGIN") || action.includes("CREATED")) return "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400";
    if (action.includes("UPDATED") || action.includes("CHANGED")) return "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400";
    if (action.includes("WORKFLOW") || action.includes("TRIGGERED")) return "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
          <Shield className="h-5 w-5 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">System audit trail — administrator only</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search logs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Action" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {actions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterUser} onValueChange={setFilterUser}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="User" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterResult} onValueChange={setFilterResult}>
          <SelectTrigger className="h-9 w-[120px]"><SelectValue placeholder="Result" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Results</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failure">Failure</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {["Timestamp","User","Action","Entity","IP","Result","Details"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No logs match your filters.</td></tr>
              ) : filtered.map((log) => (
                <tr key={log.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(log.timestamp)}</td>
                  <td className="px-4 py-3 text-xs font-medium">{log.userName}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded font-medium", getActionColor(log.action))}>{log.action}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="font-medium">{log.entity}</span>
                    <span className="text-muted-foreground ml-1">#{log.entityId.slice(-6)}</span>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{log.ip}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", log.result === "success" ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400")}>
                      {log.result}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-border">
          <p className="text-xs text-muted-foreground">Showing {filtered.length} of {logs.length} entries</p>
        </div>
      </div>
    </div>
  );
}
