import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

import { AppLayout } from "@/layouts/AppLayout";
import { AuthLayout } from "@/layouts/AuthLayout";
import { PublicLayout } from "@/layouts/PublicLayout";

import { AuthGuard } from "@/routes/guards/AuthGuard";
import { GuestGuard } from "@/routes/guards/GuestGuard";
import { RoleGuard } from "@/routes/guards/RoleGuard";

import { LoginPage } from "@/pages/auth/LoginPage";
import { ForgotPasswordPage } from "@/pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/auth/ResetPasswordPage";

import { LandingPage } from "@/pages/public/LandingPage";
import { RequestDemoPage } from "@/pages/public/RequestDemoPage";
import { BookMeetingPage } from "@/pages/public/BookMeetingPage";
import { ChatPage } from "@/pages/public/ChatPage";

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

function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">404</h1>
        <p className="text-muted-foreground mb-4">Page not found</p>
        <a href="/" className="text-primary hover:underline">Go home</a>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/request-demo" element={<RequestDemoPage />} />
              <Route path="/book-meeting" element={<BookMeetingPage />} />
              <Route path="/book" element={<BookMeetingPage />} />
            </Route>

            <Route path="/chat" element={<ChatPage />} />

            <Route
              element={
                <GuestGuard>
                  <AuthLayout />
                </GuestGuard>
              }
            >
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
            </Route>

            <Route
              path="/app"
              element={
                <AuthGuard>
                  <AppLayout />
                </AuthGuard>
              }
            >
              <Route index element={<Navigate to="/app/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="leads" element={<LeadsPage />} />
              <Route path="leads/:id" element={<LeadDetailPage />} />
              <Route path="pipeline" element={<PipelinePage />} />
              <Route path="conversations" element={<ConversationsPage />} />
              <Route path="appointments" element={<AppointmentsPage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route
                path="automations"
                element={
                  <RoleGuard allowedRoles={["ADMIN", "SALES_MANAGER"]}>
                    <AutomationsPage />
                  </RoleGuard>
                }
              />
              <Route
                path="analytics"
                element={
                  <RoleGuard allowedRoles={["ADMIN", "SALES_MANAGER"]}>
                    <AnalyticsPage />
                  </RoleGuard>
                }
              />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route
                path="team"
                element={
                  <RoleGuard allowedRoles={["ADMIN", "SALES_MANAGER"]}>
                    <TeamPage />
                  </RoleGuard>
                }
              />
              <Route
                path="audit-logs"
                element={
                  <RoleGuard allowedRoles={["ADMIN"]}>
                    <AuditLogsPage />
                  </RoleGuard>
                }
              />
              <Route
                path="integrations"
                element={
                  <RoleGuard allowedRoles={["ADMIN", "SALES_MANAGER"]}>
                    <IntegrationsPage />
                  </RoleGuard>
                }
              />
              <Route
                path="settings"
                element={
                  <RoleGuard allowedRoles={["ADMIN"]}>
                    <SettingsPage />
                  </RoleGuard>
                }
              />
              <Route path="profile" element={<ProfilePage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors closeButton />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
