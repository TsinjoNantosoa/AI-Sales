import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import { Eye, EyeOff, Loader2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { authService } from "@/services/authService";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "@/hooks/useTranslation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const schema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});
type FormData = z.infer<typeof schema>;

const DEMO_ACCOUNTS = [
  { labelKey: "auth.admin" as const, email: "admin@aisales.demo", password: "Demo123!", role: "Full access" },
  { labelKey: "auth.salesManager" as const, email: "manager@aisales.demo", password: "Demo123!", role: "Team management" },
  { labelKey: "auth.salesRep" as const, email: "sales@aisales.demo", password: "Demo123!", role: "Own leads only" },
];

export function LoginPage() {
  const { login } = useAuthStore();
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [showDemos, setShowDemos] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setError("");
    try {
      const result = await authService.login(data.email, data.password);
      login(result.user, result.token);
      toast.success(t("toast.welcomeBack", { name: result.user.firstName }));
    } catch {
      setError(t("auth.invalidCredentials"));
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemo = (email: string, password: string) => {
    setValue("email", email);
    setValue("password", password);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t("auth.welcomeBack")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("auth.signInSubtitle")}</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm mb-4">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            {...register("email")}
            className={errors.email ? "border-destructive" : ""}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
              {t("auth.forgotPassword")}
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              {...register("password")}
              className={cn("pr-10", errors.password ? "border-destructive" : "")}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="rememberMe" onCheckedChange={(v) => setValue("rememberMe", v === true)} />
          <Label htmlFor="rememberMe" className="text-sm font-normal cursor-pointer">
            {t("auth.rememberMeDays")}
          </Label>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t("auth.signingIn")}</> : t("auth.signIn")}
        </Button>
      </form>

      <div className="mt-6">
        <button
          type="button"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full justify-between py-2 border-t border-border"
          onClick={() => setShowDemos(!showDemos)}
        >
          <span className="font-medium">{t("auth.demoAccounts")}</span>
          {showDemos ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {showDemos && (
          <div className="mt-2 space-y-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => fillDemo(acc.email, acc.password)}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-muted/50 hover:bg-accent text-left transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{t(acc.labelKey)}</p>
                  <p className="text-xs text-muted-foreground">{acc.email}</p>
                </div>
                <span className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded border">{acc.role}</span>
              </button>
            ))}
            <p className="text-xs text-muted-foreground text-center">Password: <code className="bg-muted px-1 rounded">Demo123!</code></p>
          </div>
        )}
      </div>
    </div>
  );
}
