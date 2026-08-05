import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Zap, Play, Power, List, CheckCircle, XCircle, Loader2, RefreshCw, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader } from "@/components/common/LoadingSpinner";
import { automationService } from "@/services/automationService";
import type { WorkflowExecution } from "@/types";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";
import { toast } from "sonner";

export function AutomationsPage() {
  const qc = useQueryClient();
  const [executionsOpen, setExecutionsOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ["workflows"],
    queryFn: automationService.getWorkflows,
  });

  const { data: executions = [] } = useQuery({
    queryKey: ["executions"],
    queryFn: automationService.getExecutions,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enable }: { id: string; enable: boolean }) => automationService.toggleWorkflow(id, enable),
    onSuccess: (w) => {
      qc.invalidateQueries({ queryKey: ["workflows"] });
      toast.success(`Workflow ${w.status === "active" ? "enabled" : "disabled"}.`);
    },
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => automationService.testWorkflow(id),
    onMutate: (id) => setTestingId(id),
    onSuccess: (result) => { toast.success(result.message); setTestingId(null); },
    onError: () => { toast.error("Test failed."); setTestingId(null); },
  });

  if (isLoading) return <PageLoader />;

  const getExecStatusColor = (status: WorkflowExecution["status"]) => ({
    Success: "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400",
    Running: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
    Failed: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
    Retrying: "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400",
    Waiting: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  }[status] ?? "bg-muted text-muted-foreground");

  const getExecStatusIcon = (status: WorkflowExecution["status"]) => {
    if (status === "Success") return <CheckCircle className="h-3 w-3 text-green-500" />;
    if (status === "Failed") return <XCircle className="h-3 w-3 text-red-500" />;
    if (status === "Running") return <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />;
    if (status === "Retrying") return <RefreshCw className="h-3 w-3 text-orange-500 animate-spin" />;
    return <Clock className="h-3 w-3 text-gray-400" />;
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Automations</h1>
          <p className="text-sm text-muted-foreground">{workflows.filter((w) => w.status === "active").length} active workflows</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setExecutionsOpen(true)}>
          <List className="h-4 w-4" /> View Executions
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Active Workflows", value: workflows.filter((w) => w.status === "active").length, color: "text-green-600" },
          { label: "Total Executions", value: workflows.reduce((s, w) => s + w.totalExecutions, 0).toLocaleString(), color: "text-blue-600" },
          { label: "Success Rate", value: `${(workflows.reduce((s, w) => s + w.successRate, 0) / workflows.length).toFixed(1)}%`, color: "text-primary" },
          { label: "Total Errors", value: workflows.reduce((s, w) => s + w.errors, 0), color: "text-red-600" },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-lg p-4">
            <p className={cn("text-2xl font-bold", stat.color)}>{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Workflows */}
      <div className="grid md:grid-cols-2 gap-4">
        {workflows.map((w) => (
          <div key={w.id} className="bg-card border border-border rounded-xl p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", w.status === "active" ? "bg-green-100 dark:bg-green-900/20" : "bg-muted")}>
                  <Zap className={cn("h-5 w-5", w.status === "active" ? "text-green-600 dark:text-green-400" : "text-muted-foreground")} />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{w.name}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className={cn("h-1.5 w-1.5 rounded-full", w.status === "active" ? "bg-green-500" : "bg-gray-400")} />
                    <span className="text-xs text-muted-foreground capitalize">{w.status}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={testingId === w.id}
                  onClick={() => testMutation.mutate(w.id)}
                >
                  {testingId === w.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
                  Test
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("h-7 text-xs", w.status === "active" ? "text-orange-600 hover:text-orange-700" : "text-green-600 hover:text-green-700")}
                  onClick={() => toggleMutation.mutate({ id: w.id, enable: w.status === "inactive" })}
                >
                  <Power className="h-3 w-3 mr-1" />
                  {w.status === "active" ? "Disable" : "Enable"}
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{w.description}</p>

            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: "Success Rate", value: `${w.successRate}%`, color: w.successRate >= 95 ? "text-green-600 dark:text-green-400" : w.successRate >= 80 ? "text-orange-600 dark:text-orange-400" : "text-red-600 dark:text-red-400" },
                { label: "Executions", value: w.totalExecutions.toLocaleString(), color: "text-foreground" },
                { label: "Avg. Time", value: w.avgDuration, color: "text-foreground" },
                { label: "Errors", value: w.errors, color: w.errors > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400" },
              ].map((stat) => (
                <div key={stat.label} className="bg-muted/50 rounded-lg p-2">
                  <p className={cn("text-sm font-bold", stat.color)}>{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>

            {w.lastExecution && (
              <p className="text-xs text-muted-foreground mt-3">Last run: {timeAgo(w.lastExecution)}</p>
            )}
          </div>
        ))}
      </div>

      {/* Executions Modal */}
      <Dialog open={executionsOpen} onOpenChange={setExecutionsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Workflow Executions</DialogTitle></DialogHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["ID", "Workflow", "Status", "Started", "Duration", "Retries", "Lead", "Error"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {executions.map((exec) => (
                  <tr key={exec.id} className="border-b border-border hover:bg-muted/30">
                    <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{exec.id.slice(0, 8)}</td>
                    <td className="px-3 py-2 text-xs">{exec.workflowName}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        {getExecStatusIcon(exec.status)}
                        <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", getExecStatusColor(exec.status))}>{exec.status}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{timeAgo(exec.startedAt)}</td>
                    <td className="px-3 py-2 text-xs">{exec.duration}</td>
                    <td className="px-3 py-2 text-xs text-center">{exec.retryCount}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{exec.relatedLeadName ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-red-500 max-w-[120px] truncate">{exec.errorMessage ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
