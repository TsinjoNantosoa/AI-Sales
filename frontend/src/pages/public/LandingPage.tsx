import { Link } from "react-router-dom";
import {
  UserCheck, BarChart3, CalendarDays, Workflow,
  ArrowRight, CheckCircle2, Globe, ShieldCheck, GitBranch,
  Gauge, Flame, Users, MessageSquare, Plug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { BrandLogo } from "@/components/common/BrandLogo";
import { AppIcon } from "@/components/ui/AppIcon";
import { INTEGRATION_ICONS } from "@/lib/icons";
import type { LucideIcon } from "lucide-react";

const FEATURES: { icon: LucideIcon; titleKey: string; descKey: string; color: string }[] = [
  { icon: UserCheck, titleKey: "landing.featQualifyTitle", descKey: "landing.featQualifyDesc", color: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400" },
  { icon: Gauge, titleKey: "landing.featScoreTitle", descKey: "landing.featScoreDesc", color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" },
  { icon: GitBranch, titleKey: "landing.featPipelineTitle", descKey: "landing.featPipelineDesc", color: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400" },
  { icon: CalendarDays, titleKey: "landing.featCalendarTitle", descKey: "landing.featCalendarDesc", color: "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400" },
  { icon: Workflow, titleKey: "landing.featFollowTitle", descKey: "landing.featFollowDesc", color: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400" },
  { icon: BarChart3, titleKey: "landing.featAnalyticsTitle", descKey: "landing.featAnalyticsDesc", color: "bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400" },
];

const STEPS = [
  { step: "01", titleKey: "landing.step1Title", descKey: "landing.step1Desc" },
  { step: "02", titleKey: "landing.step2Title", descKey: "landing.step2Desc" },
  { step: "03", titleKey: "landing.step3Title", descKey: "landing.step3Desc" },
  { step: "04", titleKey: "landing.step4Title", descKey: "landing.step4Desc" },
];

type IntegrationStatus = "ready" | "demo" | "coming_soon";

const INTEGRATIONS: { name: string; descKey: string; status: IntegrationStatus; logo: string }[] = [
  { name: "n8n", descKey: "landing.intN8n", status: "ready", logo: "n8n" },
  { name: "Google Calendar", descKey: "landing.intCalendar", status: "demo", logo: "calendar" },
  { name: "Gmail", descKey: "landing.intGmail", status: "demo", logo: "mail" },
  { name: "HubSpot", descKey: "landing.intHubspot", status: "coming_soon", logo: "hubspot" },
  { name: "Odoo", descKey: "landing.intOdoo", status: "coming_soon", logo: "odoo" },
  { name: "Airtable", descKey: "landing.intAirtable", status: "coming_soon", logo: "airtable" },
  { name: "Slack", descKey: "landing.intSlack", status: "coming_soon", logo: "slack" },
];

const JOURNEY: { icon: LucideIcon; labelKey: string; metaKey: string }[] = [
  { icon: Users, labelKey: "landing.journeyLead", metaKey: "landing.journeyLeadMeta" },
  { icon: MessageSquare, labelKey: "landing.journeyChat", metaKey: "landing.journeyChatMeta" },
  { icon: Gauge, labelKey: "landing.journeyScore", metaKey: "landing.journeyScoreMeta" },
  { icon: Flame, labelKey: "landing.journeyHot", metaKey: "landing.journeyHotMeta" },
  { icon: CalendarDays, labelKey: "landing.journeyMeeting", metaKey: "landing.journeyMeetingMeta" },
];

const STATS = [
  { value: "86%", labelKey: "landing.statQualify" },
  { value: "3×", labelKey: "landing.statFaster" },
  { value: "32%", labelKey: "landing.statLift" },
  { value: "< 2m", labelKey: "landing.statResponse" },
];

export function LandingPage() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="shrink-0 min-w-0">
            <BrandLogo
              variant="full"
              size="sm"
              constrain="height"
              className="h-[42px] max-w-[200px]"
            />
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">{t("landing.features")}</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">{t("landing.howItWorks")}</a>
            <a href="#integrations" className="hover:text-foreground transition-colors">{t("landing.integrations")}</a>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm" className="hidden sm:flex">{t("landing.signIn")}</Button>
            </Link>
            <Link to="/request-demo">
              <Button size="sm" className="gap-1.5">
                {t("landing.requestDemo")}
                <AppIcon name="arrow" size="xs" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-[#0f1e40] to-slate-900 text-white py-16 sm:py-24 px-4 sm:px-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/15 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-400/30 bg-blue-500/10 text-blue-300 text-xs sm:text-sm mb-6 sm:mb-8">
            <Workflow className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t("landing.heroBadge")}
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold leading-tight mb-4 sm:mb-6">
            {t("landing.heroTitle")}
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto mb-8 sm:mb-10 px-4">
            {t("landing.heroSubtitle")}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
            <Link to="/request-demo" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto text-base px-6 sm:px-8 bg-white text-slate-900 hover:bg-slate-100 font-semibold gap-2">
                {t("landing.requestDemo")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
            <Link to="/login" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-6 sm:px-8 border-white/30 text-white hover:bg-white/10 gap-2">
                {t("landing.openCrmDemo")}
              </Button>
            </Link>
          </div>

          <div className="mt-8 sm:mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-400 px-4">
            {[t("landing.trustNoCard"), t("landing.trustFree"), t("landing.trustSetup")].map((text) => (
              <div key={text} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" aria-hidden="true" />
                <span>{text}</span>
              </div>
            ))}
          </div>

          <div className="relative max-w-4xl mx-auto mt-12 sm:mt-16 px-2 sm:px-0">
            <div className="rounded-xl border border-white/10 glass-card p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-3 text-left">{t("landing.illustrative")}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-3 sm:mb-4">
                {STATS.map((stat) => (
                  <div key={stat.value} className="glass-card rounded-lg p-3 text-center border border-white/10">
                    <p className="text-xl sm:text-2xl font-bold text-white">{stat.value}</p>
                    <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">{t(stat.labelKey)}</p>
                  </div>
                ))}
              </div>
              <div className="glass-card rounded-lg p-3 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">{t("landing.pipelineActivity")}</span>
                  <span className="text-xs text-emerald-400 font-semibold">+15.8%</span>
                </div>
                <div className="flex items-end gap-1 h-10 sm:h-12" aria-hidden="true">
                  {[35, 52, 44, 68, 58, 82, 65, 90, 75, 95, 82, 70].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, background: `rgba(59,130,246,${0.3 + (i / 12) * 0.4})` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border py-8 sm:py-12 px-4 sm:px-6 bg-muted/20">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {[
              { v: "248+", l: t("landing.barLeads") },
              { v: "96%", l: t("landing.barAutomation") },
              { v: "$184K", l: t("landing.barPipeline") },
              { v: "1m 42s", l: t("landing.barAi") },
            ].map((s) => (
              <div key={s.v}>
                <p className="text-2xl sm:text-3xl font-bold text-foreground">{s.v}</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">{s.l}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground text-center mt-4">{t("landing.illustrative")}</p>
        </div>
      </section>

      <section className="py-16 sm:py-20 px-4 sm:px-6" id="product-in-action">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3">{t("landing.journeyTitle")}</h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">{t("landing.journeySubtitle")}</p>
          </div>
          <div className="flex flex-col md:flex-row md:items-stretch gap-3 md:gap-0">
            {JOURNEY.map((step, i) => (
              <div key={step.labelKey} className="flex-1 flex md:flex-col items-center md:items-stretch gap-3">
                <div className="flex-1 rounded-xl border border-border bg-card p-4 flex md:flex-col items-center md:text-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <step.icon className="h-5 w-5" aria-hidden="true" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t(step.labelKey)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t(step.metaKey)}</p>
                  </div>
                </div>
                {i < JOURNEY.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 hidden md:block self-center mx-1" aria-hidden="true" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="py-16 sm:py-20 px-4 sm:px-6 bg-muted/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3 sm:mb-4">{t("landing.featuresHeading")}</h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">{t("landing.featuresSub")}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {FEATURES.map((f) => (
              <div key={f.titleKey} className="p-5 sm:p-6 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors duration-200">
                <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center mb-4", f.color)}>
                  <f.icon className="h-5 w-5" aria-hidden="true" strokeWidth={1.75} />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">{t(f.titleKey)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t(f.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-16 sm:py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3 sm:mb-4">{t("landing.howItWorks")}</h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">{t("landing.howSub")}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
            {STEPS.map((step, i) => (
              <div key={step.step} className="relative text-center">
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-7 left-[calc(50%+28px)] right-[-50%] h-px bg-border" aria-hidden="true" />
                )}
                <div className="relative inline-flex h-14 w-14 rounded-xl bg-blue-600 text-white text-lg font-bold items-center justify-center mb-4">
                  {step.step}
                </div>
                <h3 className="font-semibold text-foreground mb-2 text-sm sm:text-base">{t(step.titleKey)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t(step.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="integrations" className="py-16 sm:py-20 px-4 sm:px-6 bg-muted/20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs sm:text-sm mb-4">
              <Globe className="h-3.5 w-3.5" aria-hidden="true" /> {t("landing.integrations")}
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3 sm:mb-4">{t("landing.intHeading")}</h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">{t("landing.intSub")}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {INTEGRATIONS.map((intg) => {
              const Icon = INTEGRATION_ICONS[intg.logo] ?? PlugFallback;
              return (
                <div
                  key={intg.name}
                  className={cn(
                    "p-4 rounded-xl border text-center",
                    intg.status === "coming_soon" ? "border-border/50 bg-muted/20 opacity-70" : "border-border bg-card"
                  )}
                >
                  <div className="h-10 w-10 mx-auto mb-2 rounded-lg bg-muted flex items-center justify-center text-foreground">
                    <Icon className="h-5 w-5" aria-hidden="true" strokeWidth={1.75} />
                  </div>
                  <p className="text-sm font-semibold text-foreground">{intg.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t(intg.descKey)}</p>
                  <span
                    className={cn(
                      "inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full border",
                      intg.status === "ready" && "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
                      intg.status === "demo" && "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
                      intg.status === "coming_soon" && "bg-muted text-muted-foreground border-border"
                    )}
                  >
                    {intg.status === "ready" ? t("landing.statusReady") : intg.status === "demo" ? t("landing.statusDemo") : t("landing.statusSoon")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20 px-4 sm:px-6 bg-blue-600 text-white">
        <div className="max-w-3xl mx-auto text-center">
          <ShieldCheck className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-5 sm:mb-6 opacity-80" aria-hidden="true" />
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">{t("landing.getStarted")}</h2>
          <p className="text-blue-100 mb-6 sm:mb-8 text-base sm:text-lg">{t("landing.ctaSub")}</p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
            <Link to="/request-demo" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto bg-white text-blue-700 hover:bg-slate-100 px-6 sm:px-8 font-semibold gap-2">
                {t("landing.requestDemo")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
            <Link to="/login" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-white/40 text-white hover:bg-white/10 px-6 sm:px-8">
                {t("landing.openCrmDemo")}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8 sm:py-10 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col gap-6 sm:gap-4">
          <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-4">
            <Link to="/" className="shrink-0">
              <BrandLogo variant="full" size="sm" className="w-[168px] max-w-[168px]" />
            </Link>
            <nav className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-muted-foreground">
              <a href="#how-it-works" className="hover:text-foreground transition-colors">{t("landing.footerProduct")}</a>
              <a href="#features" className="hover:text-foreground transition-colors">{t("landing.features")}</a>
              <a href="#integrations" className="hover:text-foreground transition-colors">{t("landing.integrations")}</a>
              <Link to="/request-demo" className="hover:text-foreground transition-colors">{t("landing.footerContact")}</Link>
            </nav>
          </div>
          <p className="text-xs text-muted-foreground text-center sm:text-right">
            © {year} {t("landing.brandName")}. {t("landing.rights")}
          </p>
        </div>
      </footer>
    </div>
  );
}

function PlugFallback({ className, ...props }: { className?: string; strokeWidth?: number }) {
  return <Plug className={className} {...props} />;
}
