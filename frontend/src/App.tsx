import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";

import { AppLayout } from "@/layouts/AppLayout";
import { AuthLayout } from "@/layouts/AuthLayout";
import { PublicLayout } from "@/layouts/PublicLayout";

import { LoginPage } from "@/pages/auth/LoginPage";
import { ForgotPasswordPage } from "@/pages/auth/ForgotPasswordPage";

import { LandingPage } from "@/pages/public/LandingPage";
import { RequestDemoPage } from "@/pages/public/RequestDemoPage";
import { BookMeetingPage } from "@/pages/public/BookMeetingPage";

import { DashboardPage } from "@/pages/app/DashboardPage";
import { LeadsPage } from "@/pages/app/LeadsPage";
import { LeadDetailPage } from "@/pages/app/LeadDetailPage";
import { PipelinePage } from "@/pages/app/PipelinePage";
import { ConversationsPage } from "@/pages/app/ConversationsPage";
import { AppointmentsPage } from "@/pages/app/AppointmentsPage";
import { TasksPage } from "@/pages/app/TasksPage";
import { AutomationsPage } from "@/pages/app/AutomationsPage";
import { AnalyticsPage } from "@/pages/app/AnalyticsPage";
import { NotificationsPage } from "@/pages/app/NotificationsPage";
import { TeamPage } from "@/pages/app/TeamPage";
import { AuditLogsPage } from "@/pages/app/AuditLogsPage";
import { IntegrationsPage } from "@/pages/app/IntegrationsPage";
import { SettingsPage } from "@/pages/app/SettingsPage";
import { ProfilePage } from "@/pages/app/ProfilePage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/request-demo" element={<RequestDemoPage />} />
              <Route path="/book-meeting" element={<BookMeetingPage />} />
            </Route>

            {/* Auth Routes */}
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            </Route>

            {/* App Routes */}
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<Navigate to="/app/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="leads" element={<LeadsPage />} />
              <Route path="leads/:id" element={<LeadDetailPage />} />
              <Route path="pipeline" element={<PipelinePage />} />
              <Route path="conversations" element={<ConversationsPage />} />
              <Route path="appointments" element={<AppointmentsPage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="automations" element={<AutomationsPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="team" element={<TeamPage />} />
              <Route path="audit-logs" element={<AuditLogsPage />} />
              <Route path="integrations" element={<IntegrationsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
