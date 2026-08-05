import { Link } from "react-router-dom";
import {
  Bot, Zap, BarChart3, Calendar, MessageSquare, TrendingUp,
  ArrowRight, CheckCircle, Star, ChevronRight, Globe, Shield,
  Users, Layers, Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FEATURES = [
  { icon: Cpu, title: "AI Lead Qualification", desc: "Automatically qualify prospects using conversational AI — gathering budget, urgency, and fit in seconds.", color: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400" },
  { icon: TrendingUp, title: "Automatic Lead Scoring", desc: "Multi-criteria scoring engine evaluates every lead and ranks them so your team focuses on the best opportunities.", color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" },
  { icon: Layers, title: "CRM Pipeline", desc: "Visual Kanban board with drag-and-drop to manage your entire sales pipeline from first contact to closed deal.", color: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400" },
  { icon: Calendar, title: "Calendar Booking", desc: "Seamless Google Calendar integration — prospects can book meetings directly without back-and-forth emails.", color: "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400" },
  { icon: Zap, title: "Automated Follow-ups", desc: "n8n-powered workflows send personalized follow-up sequences automatically after 1, 3, and 7 days.", color: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400" },
  { icon: BarChart3, title: "Sales Analytics", desc: "Rich dashboards with conversion funnels, source performance, team metrics, and AI performance tracking.", color: "bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400" },
];

const STEPS = [
  { step: "01", title: "Capture the Lead", desc: "Visitors fill your smart form or chat with Ava, your AI assistant, directly on your website." },
  { step: "02", title: "Qualify with AI", desc: "Ava asks targeted questions, scores the lead automatically, and classifies them as Cold, Warm, or Hot." },
  { step: "03", title: "Book a Meeting", desc: "Hot leads get instant access to available calendar slots — no friction, no delays." },
  { step: "04", title: "Convert", desc: "Your CRM tracks every interaction, automates follow-ups, and surfaces the next best action." },
];

const INTEGRATIONS = [
  { name: "n8n", desc: "Workflow automation", available: true, icon: "⚡" },
  { name: "Google Calendar", desc: "Meeting scheduling", available: true, icon: "📅" },
  { name: "Gmail", desc: "Email automation", available: true, icon: "📧" },
  { name: "HubSpot", desc: "CRM sync", available: false, icon: "🔶" },
  { name: "Odoo", desc: "ERP integration", available: false, icon: "🟣" },
  { name: "Airtable", desc: "Data sync", available: false, icon: "📊" },
  { name: "Slack", desc: "Notifications", available: false, icon: "💬" },
];

const STATS = [
  { value: "86%", label: "Lead qualification rate" },
  { value: "3×", label: "Faster response time" },
  { value: "32%", label: "Avg. conversion lift" },
  { value: "< 2m", label: "AI response time" },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <span className="text-base font-bold text-foreground">AI Sales Assistant</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a>
            <a href="#integrations" className="hover:text-foreground transition-colors">Integrations</a>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm" className="hidden sm:flex">Sign In</Button>
            </Link>
            <Link to="/request-demo">
              <Button size="sm" className="gap-1.5">Request Demo <ArrowRight className="h-3.5 w-3.5" /></Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-[#0f1e40] to-slate-900 text-white py-16 sm:py-24 px-4 sm:px-6">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/15 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-400/30 bg-blue-500/10 text-blue-300 text-xs sm:text-sm mb-6 sm:mb-8">
            <Zap className="h-3.5 w-3.5 shrink-0" />
            Powered by AI · Integrated with n8n & Google Calendar
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold leading-tight mb-4 sm:mb-6">
            Convert More Leads with an
            <span className="block mt-1 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
              AI-Powered Sales Assistant
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto mb-8 sm:mb-10 px-4">
            Qualify prospects automatically, automate follow-ups, and book meetings — all in one platform. Let AI handle the routine so your team can focus on closing.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
            <Link to="/request-demo" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto text-base px-6 sm:px-8 bg-white text-slate-900 hover:bg-slate-100 font-semibold gap-2">
                Request a Demo <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-6 sm:px-8 border-white/30 text-white hover:bg-white/10 gap-2">
                <Bot className="h-4 w-4" /> View Live Demo
              </Button>
            </Link>
          </div>

          <div className="mt-8 sm:mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-400 px-4">
            {["No credit card required", "Free demo available", "Setup in minutes"].map((text) => (
              <div key={text} className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>{text}</span>
              </div>
            ))}
          </div>

          {/* Dashboard mockup */}
          <div className="relative max-w-4xl mx-auto mt-12 sm:mt-16 px-2 sm:px-0">
            <div className="rounded-xl border border-white/10 glass-card p-4 shadow-2xl">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-3 sm:mb-4">
                {STATS.map((stat) => (
                  <div key={stat.value} className="glass-card rounded-lg p-3 text-center border border-white/10">
                    <p className="text-xl sm:text-2xl font-bold text-white">{stat.value}</p>
                    <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>
              <div className="glass-card rounded-lg p-3 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">Pipeline Activity (30 days)</span>
                  <span className="text-xs text-emerald-400 font-semibold">↑ 15.8%</span>
                </div>
                <div className="flex items-end gap-1 h-10 sm:h-12">
                  {[35,52,44,68,58,82,65,90,75,95,82,70].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, background: `rgba(59,130,246,${0.3 + (i / 12) * 0.4})` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <section className="border-b border-border py-8 sm:py-12 px-4 sm:px-6 bg-muted/20">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { v: "248+", l: "Leads Managed" },
            { v: "96%", l: "Automation Success" },
            { v: "$184K", l: "Pipeline Value" },
            { v: "1m 42s", l: "Avg. AI Response" },
          ].map((s) => (
            <div key={s.v}>
              <p className="text-2xl sm:text-3xl font-bold text-foreground">{s.v}</p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-16 sm:py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs sm:text-sm mb-4">
              <Star className="h-3.5 w-3.5" /> Features
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3 sm:mb-4">Everything your sales team needs</h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">One platform to capture, qualify, nurture, and convert leads — powered by AI and automation.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="card-hover p-5 sm:p-6 rounded-xl border border-border bg-card">
                <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center mb-4", f.color)}>
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="py-16 sm:py-20 px-4 sm:px-6 bg-muted/20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3 sm:mb-4">How It Works</h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">A seamless journey from first contact to closed deal.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {STEPS.map((step, i) => (
              <div key={step.step} className="relative text-center">
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-7 left-1/2 w-full h-0.5 bg-gradient-to-r from-border to-transparent" />
                )}
                <div className="relative inline-flex h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 text-white text-lg font-bold items-center justify-center mb-4 shadow-lg shadow-blue-600/25">
                  {step.step}
                </div>
                <h3 className="font-semibold text-foreground mb-2 text-sm sm:text-base">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Integrations ── */}
      <section id="integrations" className="py-16 sm:py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs sm:text-sm mb-4">
              <Globe className="h-3.5 w-3.5" /> Integrations
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3 sm:mb-4">Connects with your stack</h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">Native integrations with the tools your team already uses.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {INTEGRATIONS.map((intg) => (
              <div
                key={intg.name}
                className={cn(
                  "card-hover p-4 rounded-xl border text-center transition-all",
                  intg.available ? "border-border bg-card" : "border-border/50 bg-muted/20 opacity-60"
                )}
              >
                <div className="text-2xl mb-2">{intg.icon}</div>
                <p className="text-sm font-semibold text-foreground">{intg.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{intg.desc}</p>
                {!intg.available && (
                  <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                    Coming soon
                  </span>
                )}
                {intg.available && (
                  <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    Available
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 bg-gradient-to-br from-blue-600 to-blue-700 text-white">
        <div className="max-w-3xl mx-auto text-center">
          <Shield className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-5 sm:mb-6 opacity-80" />
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">Get Started Today</h2>
          <p className="text-blue-100 mb-6 sm:mb-8 text-base sm:text-lg">Join the businesses using AI Sales Assistant to convert more leads with less effort.</p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
            <Link to="/request-demo" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto bg-white text-blue-700 hover:bg-slate-100 px-6 sm:px-8 font-semibold gap-2">
                Request a Demo <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-white/40 text-white hover:bg-white/10 px-6 sm:px-8 gap-2">
                View Demo CRM
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-8 sm:py-10 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col gap-6 sm:gap-4">
          <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-foreground">AI Sales Assistant</span>
            </div>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-muted-foreground">
              {["Product","Features","Integrations","Privacy","Terms","Contact"].map((link) => (
                <a key={link} href="#" className="hover:text-foreground transition-colors">{link}</a>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center sm:text-right">
            © 2024 AI Sales Assistant. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
