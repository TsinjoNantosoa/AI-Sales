import { useQuery } from "@tanstack/react-query";
import {
  Users, UserPlus, TrendingUp, Flame, Calendar, Target,
  DollarSign, Clock, Activity, Star, ArrowRight,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ScoreIndicator } from "@/components/common/ScoreIndicator";
import { UserAvatar } from "@/components/common/Avatar";
import { PageLoader } from "@/components/common/LoadingSpinner";
import { analyticsService } from "@/services/analyticsService";
import { mockLeads, mockActivities, mockAppointments, mockUsers, mockDashboardOverview } from "@/mocks/data";
import { formatCurrency, formatDate, timeAgo } from "@/lib/utils";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { DashboardOverview, PipelineStage, SourceData, TimeSeriesData } from "@/types";

const SOURCE_COLORS = ["#3b82f6","#22c55e","#8b5cf6","#f97316","#f43f5e","#64748b","#0ea5e9"];
const PIPELINE_COLORS = ["#94a3b8","#3b82f6","#f59e0b","#22c55e","#8b5cf6","#6366f1","#f97316","#10b981"];

export function DashboardPage() {
  const { data: overview = mockDashboardOverview, isLoading } = useQuery<DashboardOverview>({
    queryKey: ["dashboard-overview"],
    queryFn: () => analyticsService.getOverview() as Promise<DashboardOverview>,
  });

  const { data: timeSeries = [], isLoading: loadingTS } = useQuery<TimeSeriesData[]>({
    queryKey: ["lead-timeseries"],
    queryFn: () => analyticsService.getLeadTimeSeries() as Promise<TimeSeriesData[]>,
  });

  const { data: pipeline = [] } = useQuery<PipelineStage[]>({
    queryKey: ["pipeline-data"],
    queryFn: () => analyticsService.getPipelineData() as Promise<PipelineStage[]>,
  });

  const { data: sources = [] } = useQuery<SourceData[]>({
    queryKey: ["source-data"],
    queryFn: () => analyticsService.getSourceData() as Promise<SourceData[]>,
  });

  if (isLoading) return <PageLoader />;

  const hotLeads = mockLeads.filter((l) => l.temperature === "HOT").slice(0, 5);
  const recentActs = mockActivities.slice(0, 6);
  const upcomingAppts = mockAppointments.filter((a) => a.status === "Confirmed").slice(0, 4);
  const getUserName = (id?: string) => {
    const u = mockUsers.find((u) => u.id === id);
    return u ? `${u.firstName} ${u.lastName}` : "Unassigned";
  };

  return (
    <div className="page-wrapper">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of your sales pipeline and performance</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-800 self-start sm:self-auto">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-soft" />
          Live · Just now
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard title="Total Leads" value={overview.totalLeads} change={overview.changes.totalLeads} icon={Users} iconColor="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400" tooltip="All leads across all statuses" />
        <KpiCard title="New Leads" value={overview.newLeads} change={overview.changes.newLeads} icon={UserPlus} iconColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" tooltip="Leads created in the last 7 days" />
        <KpiCard title="Qualified" value={overview.qualifiedLeads} change={overview.changes.qualifiedLeads} icon={TrendingUp} iconColor="bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400" tooltip="Leads with score ≥ 60" />
        <KpiCard title="Hot Leads" value={overview.hotLeads} change={overview.changes.hotLeads} icon={Flame} iconColor="bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400" tooltip="Leads with score ≥ 70" />
        <KpiCard title="Meetings" value={overview.meetingsBooked} change={overview.changes.meetingsBooked} icon={Calendar} iconColor="bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400" tooltip="Meetings booked this month" />
        <KpiCard title="Conversion" value={`${overview.conversionRate}%`} change={overview.changes.conversionRate} icon={Target} iconColor="bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400" tooltip="Leads converted to won deals" />
        <KpiCard title="Pipeline Value" value={formatCurrency(overview.pipelineValue)} change={overview.changes.pipelineValue} icon={DollarSign} iconColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" tooltip="Total estimated pipeline value" />
        <KpiCard title="Avg. Response" value={overview.avgResponseTime} icon={Clock} iconColor="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" tooltip="Average AI first-response time" />
      </div>

      {/* ── Charts Row 1 ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Lead Generation */}
        <div className="md:col-span-2 bg-card rounded-xl border border-border p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Lead Generation</h3>
              <p className="text-xs text-muted-foreground mt-0.5">New leads · last 30 days</p>
            </div>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">↑ +{overview.changes.newLeads.toFixed(1)}%</span>
          </div>
          {loadingTS ? (
            <div className="h-44 bg-muted/30 rounded-lg animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={timeSeries} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v: string) => v.slice(5)} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                  labelFormatter={(l: string) => formatDate(l)}
                  itemStyle={{ color: "#3b82f6" }}
                />
                <Area type="monotone" dataKey="value" name="Leads" stroke="#3b82f6" strokeWidth={2.5} fill="url(#leadGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Lead Sources */}
        <div className="bg-card rounded-xl border border-border p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-foreground mb-0.5">Lead Sources</h3>
          <p className="text-xs text-muted-foreground mb-3">Distribution by channel</p>
          <ResponsiveContainer width="100%" height={130}>
            <PieChart>
              <Pie data={sources} dataKey="count" nameKey="source" cx="50%" cy="50%" outerRadius={55} innerRadius={30} paddingAngle={3}>
                {sources.map((_: SourceData, i: number) => (
                  <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-1">
            {sources.slice(0, 5).map((s: SourceData, i: number) => (
              <div key={s.source} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ background: SOURCE_COLORS[i % SOURCE_COLORS.length] }} />
                  <span className="text-xs text-muted-foreground">{s.source}</span>
                </div>
                <span className="text-xs font-semibold">{s.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Pipeline Chart ── */}
      {pipeline.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Pipeline Overview</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Leads by stage</p>
            </div>
            <Link to="/app/pipeline">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                View Pipeline <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={pipeline} barSize={28} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="status" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v: string) => v.replace("_", " ").split(" ")[0]} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: 12 }}
                formatter={(v: number, n: string) => [n === "value" ? formatCurrency(v) : v, n === "value" ? "Value" : "Leads"]}
              />
              <Bar dataKey="count" name="Leads" radius={[4, 4, 0, 0]}>
                {pipeline.map((_: PipelineStage, i: number) => (
                  <Cell key={i} fill={PIPELINE_COLORS[i % PIPELINE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Bottom Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {/* Recent Activity */}
        <div className="bg-card rounded-xl border border-border p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            {recentActs.map((a) => (
              <div key={a.id} className="flex items-start gap-2.5">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground leading-snug line-clamp-2">{a.description}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(a.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hot Leads */}
        <div className="bg-card rounded-xl border border-border p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Priority Leads</h3>
            <Star className="h-4 w-4 text-amber-500" />
          </div>
          <div className="space-y-2">
            {hotLeads.map((lead) => (
              <Link
                key={lead.id}
                to={`/app/leads/${lead.id}`}
                className="flex items-center gap-2.5 p-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors group"
              >
                <UserAvatar firstName={lead.firstName} lastName={lead.lastName} id={lead.id} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">
                    {lead.firstName} {lead.lastName}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">{lead.companyName}</p>
                </div>
                <ScoreIndicator score={lead.score} showBar />
              </Link>
            ))}
          </div>
          <Link to="/app/leads">
            <Button variant="ghost" size="sm" className="w-full mt-3 h-7 text-xs gap-1 text-muted-foreground">
              View all leads <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>

        {/* Upcoming Meetings */}
        <div className="bg-card rounded-xl border border-border p-4 sm:p-5 sm:col-span-2 md:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Upcoming Meetings</h3>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            {upcomingAppts.map((appt) => (
              <div key={appt.id} className="flex items-center gap-3">
                <div className="text-center bg-primary/10 rounded-lg p-2 shrink-0 w-[42px]">
                  <p className="text-sm font-bold text-primary leading-none">{appt.date.slice(8)}</p>
                  <p className="text-[9px] text-muted-foreground uppercase">{formatDate(appt.date, "MMM")}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{appt.leadName}</p>
                  <p className="text-[10px] text-muted-foreground">{appt.time} · {appt.duration}m · {getUserName(appt.assignedUserId).split(" ")[0]}</p>
                </div>
                <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              </div>
            ))}
          </div>
          <Link to="/app/appointments">
            <Button variant="ghost" size="sm" className="w-full mt-3 h-7 text-xs gap-1 text-muted-foreground">
              View calendar <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
