import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { PageLoader } from "@/components/common/LoadingSpinner";

export function GuestGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  if (!hasHydrated) return <PageLoader />;

  if (isAuthenticated) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <>{children}</>;
}
