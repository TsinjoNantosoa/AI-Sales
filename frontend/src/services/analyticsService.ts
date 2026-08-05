import { mockDashboardOverview, mockLeadTimeSeries, mockPipelineData, mockSourceData, mockAnalyticsData } from "@/mocks/data";
import { USE_MOCKS, apiRequest } from "./api";

const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms));

export const analyticsService = {
  async getOverview() {
    if (USE_MOCKS) { await delay(); return mockDashboardOverview; }
    return apiRequest("/dashboard/overview");
  },

  async getLeadTimeSeries() {
    if (USE_MOCKS) { await delay(); return mockLeadTimeSeries; }
    return apiRequest("/dashboard/conversions");
  },

  async getPipelineData() {
    if (USE_MOCKS) { await delay(); return mockPipelineData; }
    return apiRequest("/dashboard/pipeline");
  },

  async getSourceData() {
    if (USE_MOCKS) { await delay(); return mockSourceData; }
    return apiRequest("/dashboard/sources");
  },

  async getAnalytics() {
    if (USE_MOCKS) { await delay(600); return mockAnalyticsData; }
    return apiRequest("/dashboard/team-performance");
  },
};
