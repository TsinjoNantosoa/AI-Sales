import { lazy, Suspense } from "react";
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
import { PageLoader } from "@/components/common/LoadingSpinner";

const LoginPage = lazy(() =>
  import("@/pages/auth/LoginPage").then((m) => ({ default: m.LoginPage }))
);
const ForgotPasswordPage = lazy(() =>
  import("@/pages/auth/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage }))
);
const ResetPasswordPage = lazy(() =>
  import("@/pages/auth/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage }))
);

const LandingPage = lazy(() =>
  import("@/pages/public/LandingPage").then((m) => ({ default: m.LandingPage }))
);
const RequestDemoPage = lazy(() =>
  import("@/pages/public/RequestDemoPage").then((m) => ({ default: m.RequestDemoPage }))
);
const BookMeetingPage = lazy(() =>
  import("@/pages/public/BookMeetingPage").then((m) => ({ default: m.BookMeetingPage }))
);
const ChatPage = lazy(() =>
  import("@/pages/public/ChatPage").then((m) => ({ default: m.ChatPage }))
);

const DashboardPage = lazy(() =>
  import("@/pages/app/DashboardPage").then((m) => ({ default: m.DashboardPage }))
);
const LeadsPage = lazy(() =>
  import("@/pages/app/LeadsPage").then((m) => ({ default: m.LeadsPage }))
);
const LeadDetailPage = lazy(() =>
  import("@/pages/app/LeadDetailPage").then((m) => ({ default: m.LeadDetailPage }))
);
const PipelinePage = lazy(() =>
  import("@/pages/app/PipelinePage").then((m) => ({ default: m.PipelinePage }))
);
const ConversationsPage = lazy(() =>
  import("@/pages/app/ConversationsPage").then((m) => ({ default: m.ConversationsPage }))
);
const AppointmentsPage = lazy(() =>
  import("@/pages/app/AppointmentsPage").then((m) => ({ default: m.AppointmentsPage }))
);
const TasksPage = lazy(() =>
  import("@/pages/app/TasksPage").then((m) => ({ default: m.TasksPage }))
);
const AutomationsPage = lazy(() =>
  import("@/pages/app/AutomationsPage").then((m) => ({ default: m.AutomationsPage }))
);
const AnalyticsPage = lazy(() =>
  import("@/pages/app/AnalyticsPage").then((m) => ({ default: m.AnalyticsPage }))
);
const NotificationsPage = lazy(() =>
  import("@/pages/app/NotificationsPage").then((m) => ({ default: m.NotificationsPage }))
);
const TeamPage = lazy(() =>
  import("@/pages/app/TeamPage").then((m) => ({ default: m.TeamPage }))
);
const AuditLogsPage = lazy(() =>
  import("@/pages/app/AuditLogsPage").then((m) => ({ default: m.AuditLogsPage }))
);
const IntegrationsPage = lazy(() =>
  import("@/pages/app/IntegrationsPage").then((m) => ({ default: m.IntegrationsPage }))
);
const SettingsPage = lazy(() =>
  import("@/pages/app/SettingsPage").then((m) => ({ default: m.SettingsPage }))
);
const ProfilePage = lazy(() =>
  import("@/pages/app/ProfilePage").then((m) => ({ default: m.ProfilePage }))
);

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
          <Suspense fallback={<PageLoader />}>
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
          </Suspense>
        </BrowserRouter>
        <Toaster position="top-right" richColors closeButton />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
