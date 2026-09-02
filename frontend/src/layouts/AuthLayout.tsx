import { Outlet, Navigate, Link } from "react-router-dom";
import { UserCheck, TrendingUp, CalendarDays } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { Toaster } from "sonner";
import { BrandLogo } from "@/components/common/BrandLogo";

const FEATURES = [
  { icon: UserCheck, text: "AI lead qualification in seconds" },
  { icon: TrendingUp, text: "Automatic lead scoring and routing" },
  { icon: CalendarDays, text: "Calendar booking integration" },
];

export function AuthLayout() {
  const { isAuthenticated, hasHydrated } = useAuthStore();
  if (!hasHydrated) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (isAuthenticated) return <Navigate to="/app/dashboard" replace />;

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex flex-col justify-between w-[480px] xl:w-[520px] bg-gradient-to-br from-slate-900 via-[#0f1e40] to-slate-900 p-10 shrink-0">
        <Link to="/" className="inline-block max-w-[280px]">
          <BrandLogo variant="full" size="lg" />
        </Link>

        <div className="space-y-8">
          <div>
            <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight mb-4">
              Turn every lead into a
              <br />
              <span className="text-blue-300">qualified opportunity</span>
            </h1>
            <p className="text-slate-400 leading-relaxed">
              Sales automation that qualifies prospects, scores leads, and books meetings — so your team focuses on closing.
            </p>
          </div>
          <div className="space-y-3">
            {FEATURES.map((f) => (
              <div key={f.text} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                  <f.icon className="h-4 w-4 text-blue-400" aria-hidden="true" strokeWidth={1.75} />
                </div>
                <span className="text-sm text-slate-300">{f.text}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10">
              {[
                { v: "86%", l: "Qualification rate" },
                { v: "3×", l: "Faster responses" },
                { v: "32%", l: "More conversions" },
              ].map((s) => (
                <div key={s.v}>
                  <p className="text-2xl font-bold text-white">{s.v}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{s.l}</p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-3">Illustrative data</p>
          </div>
        </div>

        <div className="glass-card rounded-xl p-5">
          <p className="text-sm text-slate-300 leading-relaxed">
            We qualified 3× more leads in our first month and cut our response time from hours to minutes.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">SJ</div>
            <div>
              <p className="text-xs font-semibold text-white">Sarah Johnson</p>
              <p className="text-[10px] text-slate-400">Sales Manager · Sample environment</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 bg-background">
        <Link to="/" className="lg:hidden mb-8 inline-block max-w-[200px]">
          <BrandLogo variant="full" size="md" onLight />
        </Link>

        <div className="w-full max-w-sm sm:max-w-md">
          <div className="bg-card rounded-2xl border border-border p-6 sm:p-8">
            <Outlet />
          </div>
        </div>
      </div>

      <Toaster position="top-right" richColors />
    </div>
  );
}
