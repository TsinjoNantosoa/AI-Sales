import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2, ArrowRight, Calendar, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { leadService } from "@/services/leadService";
import { publicService } from "@/services/publicService";
import { USE_MOCKS } from "@/lib/constants";
import { parseBudgetRange } from "@/lib/score";
import { toast } from "sonner";
import { BrandLogo } from "@/components/common/BrandLogo";
import { useTranslation } from "@/hooks/useTranslation";

const SERVICES = [
  "AI Automation", "CRM Automation", "RAG Chatbot", "n8n Workflow Development",
  "Odoo Integration", "Custom Software Development", "Other",
];
const BUDGETS = ["Less than $1,000", "$1,000 – $3,000", "$3,000 – $5,000", "$5,000 – $10,000", "More than $10,000", "Not defined yet"];
const TIMELINES = ["Immediately", "Within 30 days", "Within 3 months", "More than 3 months", "Not defined yet"];
const COMPANY_SIZES = ["1–10", "11–50", "51–200", "201–500", "500+"];
const CHANNELS = ["Email", "Phone", "Video call", "WhatsApp"];
const COUNTRIES = ["United States", "France", "United Kingdom", "Germany", "Canada", "Australia", "Madagascar", "South Africa", "Other"];

const schema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  companyName: z.string().min(1, "Required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  country: z.string().min(1, "Required"),
  language: z.string().optional(),
  companySize: z.string().min(1, "Required"),
  serviceNeeded: z.string().min(1, "Required"),
  estimatedBudget: z.string().min(1, "Required"),
  desiredTimeline: z.string().min(1, "Required"),
  projectDescription: z.string().min(10, "Please describe your project (min 10 characters)"),
  preferredContactChannel: z.string().min(1, "Required"),
  consent: z.boolean().refine((v) => v === true, "You must accept to proceed"),
});
type FormData = z.infer<typeof schema>;

const STEPS = ["Contact", "Project", "Preferences"];

export function RequestDemoPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { consent: false, language: "en" },
  });

  const { register, handleSubmit, setValue, watch, trigger, formState: { errors } } = form;

  const nextStep = async () => {
    const fields: (keyof FormData)[][] = [
      ["firstName", "lastName", "companyName", "email", "phone", "country", "companySize"],
      ["serviceNeeded", "estimatedBudget", "desiredTimeline", "projectDescription"],
    ];
    const valid = await trigger(fields[step]);
    if (valid) setStep(step + 1);
  };

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const budget = parseBudgetRange(data.estimatedBudget);
      const payload = {
        firstName: data.firstName,
        lastName: data.lastName,
        companyName: data.companyName,
        email: data.email,
        phone: data.phone,
        country: data.country,
        language: data.language || "en",
        source: "Website" as const,
        serviceInterest: data.serviceNeeded,
        timeline: data.desiredTimeline,
        needDescription: data.projectDescription,
        consentGiven: data.consent,
        companySize: data.companySize,
        ...budget,
        tags: [data.preferredContactChannel, data.companySize],
        status: "NEW" as const,
      };
      const created = USE_MOCKS
        ? await leadService.createLead(payload)
        : (await publicService.createLead(payload)).lead;
      if (USE_MOCKS) {
        sessionStorage.setItem("publicLeadId", created.id);
      }
      setLeadId(created.id);
      setSubmitted(true);
      toast.success(t("common.success"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setLoading(false);
    }
  };

  if (submitted && leadId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">Request received!</h1>
          <p className="text-muted-foreground mb-8">
            Thank you! Your lead profile has been created. Continue with our AI assistant to qualify your needs, or book a meeting now.
          </p>
          <div className="space-y-3">
            <Button className="w-full gap-2" onClick={() => navigate(`/book?leadId=${leadId}`)}>
              <Calendar className="h-4 w-4" /> Schedule a Meeting Now
            </Button>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => navigate(`/chat?leadId=${leadId}`)}
            >
              <Bot className="h-4 w-4" /> Continue with AI Assistant
            </Button>
            <Link to="/">
              <Button variant="ghost" className="w-full">Back to Home</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Link>
          <BrandLogo variant="full" size="md" onLight className="mb-3" />
          <h1 className="text-2xl font-bold text-foreground">{t("landing.requestDemo")}</h1>
          <p className="text-muted-foreground text-sm mt-1">Tell us about your project and we'll set up a personalized demo.</p>
        </div>

        <div className="flex items-center gap-3 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-3 flex-1">
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 shrink-0 transition-all",
                i < step ? "bg-primary border-primary text-white" :
                i === step ? "border-primary text-primary bg-primary/10" :
                "border-border text-muted-foreground"
              )}>
                {i < step ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : i + 1}
              </div>
              <span className={cn("text-sm font-medium hidden sm:block", i === step ? "text-foreground" : "text-muted-foreground")}>{s}</span>
              {i < STEPS.length - 1 && <div className={cn("flex-1 h-0.5", i < step ? "bg-primary" : "bg-border")} />}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="bg-card rounded-xl border border-border p-6 space-y-5">
            {step === 0 && (
              <>
                <h2 className="text-lg font-semibold">Contact Information</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>First Name *</Label>
                    <Input {...register("firstName")} placeholder="John" />
                    {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Last Name *</Label>
                    <Input {...register("lastName")} placeholder="Smith" />
                    {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Company Name *</Label>
                  <Input {...register("companyName")} placeholder="ABC Consulting" />
                  {errors.companyName && <p className="text-xs text-destructive">{errors.companyName.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Business Email *</Label>
                    <Input type="email" {...register("email")} placeholder="john@company.com" />
                    {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone Number</Label>
                    <Input type="tel" {...register("phone")} placeholder="+1 555 000 0000" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Country *</Label>
                    <Select onValueChange={(v) => setValue("country", v, { shouldValidate: true })}>
                      <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                      <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                    {errors.country && <p className="text-xs text-destructive">{errors.country.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Company Size *</Label>
                    <Select onValueChange={(v) => setValue("companySize", v, { shouldValidate: true })}>
                      <SelectTrigger><SelectValue placeholder="Employees" /></SelectTrigger>
                      <SelectContent>{COMPANY_SIZES.map((s) => <SelectItem key={s} value={s}>{s} employees</SelectItem>)}</SelectContent>
                    </Select>
                    {errors.companySize && <p className="text-xs text-destructive">{errors.companySize.message}</p>}
                  </div>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <h2 className="text-lg font-semibold">Your Project</h2>
                <div className="space-y-1.5">
                  <Label>Service Needed *</Label>
                  <Select onValueChange={(v) => setValue("serviceNeeded", v, { shouldValidate: true })}>
                    <SelectTrigger><SelectValue placeholder="Select a service" /></SelectTrigger>
                    <SelectContent>{SERVICES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                  {errors.serviceNeeded && <p className="text-xs text-destructive">{errors.serviceNeeded.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Estimated Budget *</Label>
                    <Select onValueChange={(v) => setValue("estimatedBudget", v, { shouldValidate: true })}>
                      <SelectTrigger><SelectValue placeholder="Select budget" /></SelectTrigger>
                      <SelectContent>{BUDGETS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                    </Select>
                    {errors.estimatedBudget && <p className="text-xs text-destructive">{errors.estimatedBudget.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Desired Timeline *</Label>
                    <Select onValueChange={(v) => setValue("desiredTimeline", v, { shouldValidate: true })}>
                      <SelectTrigger><SelectValue placeholder="Select timeline" /></SelectTrigger>
                      <SelectContent>{TIMELINES.map((tl) => <SelectItem key={tl} value={tl}>{tl}</SelectItem>)}</SelectContent>
                    </Select>
                    {errors.desiredTimeline && <p className="text-xs text-destructive">{errors.desiredTimeline.message}</p>}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Project Description *</Label>
                  <Textarea
                    {...register("projectDescription")}
                    placeholder="Describe your project, goals, and any specific requirements..."
                    rows={4}
                  />
                  {errors.projectDescription && <p className="text-xs text-destructive">{errors.projectDescription.message}</p>}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="text-lg font-semibold">Preferences & Confirmation</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Preferred Contact Channel *</Label>
                    <Select onValueChange={(v) => setValue("preferredContactChannel", v, { shouldValidate: true })}>
                      <SelectTrigger><SelectValue placeholder="Select channel" /></SelectTrigger>
                      <SelectContent>{CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                    {errors.preferredContactChannel && <p className="text-xs text-destructive">{errors.preferredContactChannel.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Preferred Language</Label>
                    <Select onValueChange={(v) => setValue("language", v)} defaultValue="en">
                      <SelectTrigger><SelectValue placeholder="Select language" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="fr">Français</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-2">
                  <p className="text-sm font-medium">Request Summary</p>
                  <div className="grid grid-cols-2 gap-1 text-sm">
                    <span className="text-muted-foreground">Service:</span>
                    <span>{watch("serviceNeeded") || "—"}</span>
                    <span className="text-muted-foreground">Budget:</span>
                    <span>{watch("estimatedBudget") || "—"}</span>
                    <span className="text-muted-foreground">Timeline:</span>
                    <span>{watch("desiredTimeline") || "—"}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="consent"
                    checked={watch("consent")}
                    onCheckedChange={(v) => setValue("consent", v === true, { shouldValidate: true })}
                  />
                  <Label htmlFor="consent" className="text-sm font-normal cursor-pointer leading-relaxed">
                    I consent to AI Sales Assistant storing and processing my data to respond to this request, in accordance with the privacy policy.
                  </Label>
                </div>
                {errors.consent && <p className="text-xs text-destructive">You must accept to proceed</p>}
              </>
            )}
          </div>

          <div className="flex items-center justify-between mt-6">
            {step > 0 ? (
              <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
            ) : (
              <Link to="/"><Button type="button" variant="ghost"><ArrowLeft className="h-4 w-4 mr-2" /> Cancel</Button></Link>
            )}
            {step < 2 ? (
              <Button type="button" onClick={nextStep}>
                Next <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button type="submit" disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</> : "Submit Request"}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
