import type { DashboardOverview, AnalyticsData, PipelineStage, SourceData, LeadTrendPoint, Activity } from "@/types";
import { USE_MOCKS } from "@/lib/constants";
import { apiClient } from "@/lib/apiClient";
import { computeDashboardOverview, computeAnalytics, getDatabase } from "@/mocks/mockRepository";

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

export const dashboardService = {
  async getOverview(opts?: { currentUserId?: string; role?: string }): Promise<DashboardOverview> {
    if (USE_MOCKS) {
      await delay();
      const assigned =
        opts?.role === "SALES_REPRESENTATIVE" ? opts.currentUserId : undefined;
      return computeDashboardOverview(assigned);
    }
    return apiClient.get("/dashboard/overview");
  },

  async getLeadTimeSeries(opts?: { currentUserId?: string; role?: string }): Promise<LeadTrendPoint[]> {
    if (USE_MOCKS) {
      await delay();
      const assigned =
        opts?.role === "SALES_REPRESENTATIVE" ? opts.currentUserId : undefined;
      return computeAnalytics(assigned).leadTrend;
    }
    return apiClient.get("/dashboard/conversions");
  },

  async getPipelineData(opts?: { currentUserId?: string; role?: string }): Promise<PipelineStage[]> {
    if (USE_MOCKS) {
      await delay();
      const assigned =
        opts?.role === "SALES_REPRESENTATIVE" ? opts.currentUserId : undefined;
      return computeAnalytics(assigned).funnel.map((f) => ({
        status: f.status,
        count: f.count,
        value: f.value,
      }));
    }
    return apiClient.get("/dashboard/pipeline");
  },

  async getSourceData(): Promise<SourceData[]> {
    if (USE_MOCKS) {
      await delay();
      const sources = computeAnalytics().sources;
      const total = sources.reduce((s, x) => s + x.count, 0) || 1;
      return sources.map((s) => ({
        source: s.source,
        count: s.count,
        percentage: Math.round((s.count / total) * 100),
      }));
    }
    return apiClient.get("/dashboard/sources");
  },

  async getActivities(leadId?: string): Promise<Activity[]> {
    if (USE_MOCKS) {
      await delay(150);
      const acts = getDatabase().activities;
      return leadId ? acts.filter((a) => a.leadId === leadId) : [...acts];
    }
    return apiClient.get<Activity[]>("/activities", { params: { leadId } });
  },
};

export const analyticsService = {
  async getOverview(opts?: { currentUserId?: string; role?: string }) {
    return dashboardService.getOverview(opts);
  },
  async getLeadTimeSeries(opts?: { currentUserId?: string; role?: string }) {
    return dashboardService.getLeadTimeSeries(opts);
  },
  async getPipelineData(opts?: { currentUserId?: string; role?: string }) {
    return dashboardService.getPipelineData(opts);
  },
  async getSourceData() {
    return dashboardService.getSourceData();
  },
  async getAnalytics(opts?: { currentUserId?: string; role?: string }): Promise<AnalyticsData> {
    if (USE_MOCKS) {
      await delay(400);
      const assigned =
        opts?.role === "SALES_REPRESENTATIVE" ? opts.currentUserId : undefined;
      return computeAnalytics(assigned);
    }
    return apiClient.get("/analytics");
  },
};
