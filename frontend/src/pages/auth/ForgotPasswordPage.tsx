import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authService } from "@/services/authService";
import { useTranslation } from "@/hooks/useTranslation";

const schema = z.object({ email: z.string().email("Invalid email address") });
type FormData = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const { register, handleSubmit, getValues, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const result = await authService.forgotPassword(data.email);
      setResetToken(result.resetToken ?? null);
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    const resetPath = resetToken
      ? `/reset-password?token=${encodeURIComponent(resetToken)}`
      : "/reset-password";

    return (
      <div className="text-center">
        <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-7 w-7 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">{t("auth.checkInbox")}</h2>
        <p className="text-sm text-muted-foreground mb-6">
          {t("auth.resetLinkSent")} <strong>{getValues("email")}</strong>
        </p>
        {resetToken && (
          <div className="mb-6 rounded-lg border border-border bg-muted/40 p-3 text-left">
            <p className="text-xs text-muted-foreground mb-1">Demo reset link (mock):</p>
            <Link to={resetPath} className="text-sm text-primary hover:underline break-all">
              {resetPath}
            </Link>
          </div>
        )}
        <Link to="/login">
          <Button className="w-full" variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" /> {t("auth.backToLogin")}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t("auth.resetPasswordTitle")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("auth.resetPasswordSubtitle")}</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input id="email" type="email" placeholder="you@example.com" {...register("email")} className={errors.email ? "border-destructive" : ""} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("auth.sending")}</> : t("auth.sendResetLink")}
        </Button>
      </form>
      <div className="mt-4 text-center">
        <Link to="/login" className="text-sm text-primary hover:underline flex items-center justify-center gap-1">
          <ArrowLeft className="h-3 w-3" /> {t("auth.backToLogin")}
        </Link>
      </div>
    </div>
  );
}
