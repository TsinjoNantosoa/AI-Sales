import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { PageLoader } from "@/components/common/LoadingSpinner";
import { analyticsService } from "@/services/analyticsService";
import { queryKeys } from "@/lib/queryKeys";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";
import { Bot, Workflow } from "lucide-react";
import type { AnalyticsData } from "@/types";

const COLORS = ["#3b82f6","#22c55e","#f59e0b","#8b5cf6","#f43f5e","#0ea5e9","#64748b"];

export function AnalyticsPage() {
  const user = useAuthStore((s) => s.user);

  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: [...queryKeys.analytics.all, user?.id, user?.role],
    queryFn: () =>
      analyticsService.getAnalytics({
        currentUserId: user?.id,
        role: user?.role,
      }),
  });

  if (isLoading) return <PageLoader />;
  if (!analytics) return null;

  const funnel = analytics.funnel;
  const maxFunnel = funnel[0]?.count || 1;
  const avgTimeByStage = analytics.avgTimeByStage ?? [];
  const ai = analytics.aiPerformance ?? {
    conversationsHandled: 0,
    qualificationRate: 0,
    avgScore: 0,
    humanHandoffRate: 0,
    appointmentRate: 0,
  };
  const autoAgg = analytics.automationPerformance.reduce(
    (acc, w) => ({
      executions: acc.executions + w.executions,
      failed: acc.failed + w.failedExecutions,
      recovered: acc.recovered + w.recoveredExecutions,
      successSum: acc.successSum + w.successRate * w.executions,
      durationSum: acc.durationSum + w.averageDurationMs * w.executions,
    }),
    { executions: 0, failed: 0, recovered: 0, successSum: 0, durationSum: 0 }
  );
  const autoSuccessRate =
    autoAgg.executions > 0
      ? Math.round((autoAgg.successSum / autoAgg.executions) * 10) / 10
      : 0;
  const autoAvgDuration =
    autoAgg.executions > 0
      ? `${(autoAgg.durationSum / autoAgg.executions / 1000).toFixed(1)}s`
      : "—";

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground">Sales performance and pipeline insights</p>
      </div>

      {/* Lead Generation */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold mb-1">Lead Generation</h3>
        <p className="text-xs text-muted-foreground mb-4">New leads over the last 30 days</p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={analytics.leadTrend}>
            <defs>
              <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} />
            <Area type="monotone" dataKey="leads" name="Leads" stroke="#3b82f6" strokeWidth={2} fill="url(#aGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Conversion Funnel */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Conversion Funnel</h3>
          <div className="space-y-2">
            {funnel.map((stage, i) => (
              <div key={stage.status}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{stage.label}</span>
                  <span className="font-medium">{stage.count}</span>
                </div>
                <div className="h-6 bg-muted rounded overflow-hidden">
                  <div
                    className="h-full rounded flex items-center px-2"
                    style={{ width: `${(stage.count / maxFunnel) * 100}%`, background: COLORS[i % COLORS.length] }}
                  >
                    <span className="text-white text-xs font-medium truncate">
                      {((stage.count / maxFunnel) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Source Performance */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Lead Source Performance</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={analytics.sources} layout="vertical" barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis type="category" dataKey="source" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={60} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} />
              <Bar dataKey="count" name="Volume" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                {analytics.sources.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Team Performance */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold mb-4">Team Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Salesperson","Assigned","Qualified","Meetings","Wins","Conv. Rate"].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analytics.teamPerformance.map((member) => (
                <tr key={member.userId} className="border-b border-border hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{member.name}</td>
                  <td className="px-4 py-3">{member.assignedLeads}</td>
                  <td className="px-4 py-3">{member.qualifiedLeads}</td>
                  <td className="px-4 py-3">{member.meetings}</td>
                  <td className="px-4 py-3">{member.wins}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full max-w-[80px]">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${member.conversionRate}%` }} />
                      </div>
                      <span className="text-sm font-medium">{member.conversionRate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Average Time by Stage */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold mb-4">Average Time by Stage (days)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={avgTimeByStage} barSize={32}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="stage" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" unit="d" />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} formatter={(v: number) => [`${v} days`]} />
            <Bar dataKey="days" fill="#3b82f6" radius={[4, 4, 0, 0]}>
              {avgTimeByStage.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* AI & Automation Performance */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Bot className="h-4 w-4 text-primary" />AI Qualification Performance</h3>
          <div className="space-y-3">
            {[
              { label: "Conversations Handled", value: ai.conversationsHandled.toLocaleString() },
              { label: "Qualification Rate", value: `${ai.qualificationRate}%`, bar: ai.qualificationRate },
              { label: "Average Lead Score", value: `${ai.avgScore.toFixed(1)}/100`, bar: ai.avgScore },
              { label: "Human Handoff Rate", value: `${ai.humanHandoffRate}%`, bar: ai.humanHandoffRate },
              { label: "Appointment Booking Rate", value: `${ai.appointmentRate}%`, bar: ai.appointmentRate },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground text-xs">{item.label}</span>
                  <span className="font-semibold">{item.value}</span>
                </div>
                {item.bar !== undefined && (
                  <div className="h-1.5 bg-muted rounded-full">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${item.bar}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Workflow className="h-4 w-4 text-primary" aria-hidden="true" />Automation Performance</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Success Rate", value: `${autoSuccessRate}%`, color: "text-green-600 dark:text-green-400" },
              { label: "Total Executions", value: autoAgg.executions.toLocaleString(), color: "text-blue-600 dark:text-blue-400" },
              { label: "Avg. Duration", value: autoAvgDuration, color: "text-foreground" },
              { label: "Failed", value: autoAgg.failed, color: "text-red-600 dark:text-red-400" },
              { label: "Recovered", value: autoAgg.recovered, color: "text-orange-600 dark:text-orange-400" },
            ].map((stat) => (
              <div key={stat.label} className="bg-muted/50 rounded-lg p-3 text-center">
                <p className={cn("text-xl font-bold", stat.color)}>{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
