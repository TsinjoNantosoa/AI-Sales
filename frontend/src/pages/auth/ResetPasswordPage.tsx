import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authService } from "@/services/authService";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/useTranslation";
import { useState } from "react";

const schema = z
  .object({
    password: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string().min(8, "At least 8 characters"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [done, setDone] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    if (!token) {
      toast.error("Missing reset token. Use the link from the forgot-password email.");
      return;
    }
    try {
      await authService.resetPassword(token, data.password);
      setDone(true);
      toast.success("Password updated for this demo session");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    }
  });

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold">{t("auth.resetPassword")}</h1>
        <p className="text-sm text-muted-foreground">
          Your demo password was updated for this browser session only. It is not stored permanently.
        </p>
        <Button onClick={() => navigate("/login")}>{t("auth.backToLogin")}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("auth.resetPassword")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enter a new password. In mock mode this only affects the current session.
        </p>
      </div>

      {!token && (
        <p className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-lg p-3">
          No token provided. Request a reset from the forgot password page first.
        </p>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">{t("auth.newPassword")}</Label>
          <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
          {form.formState.errors.password && (
            <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">{t("auth.confirmPassword")}</Label>
          <Input id="confirmPassword" type="password" autoComplete="new-password" {...form.register("confirmPassword")} />
          {form.formState.errors.confirmPassword && (
            <p className="text-xs text-destructive">{form.formState.errors.confirmPassword.message}</p>
          )}
        </div>
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting || !token}>
          {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.resetPassword")}
        </Button>
      </form>

      <Link to="/login" className="block text-center text-sm text-primary hover:underline">
        {t("auth.backToLogin")}
      </Link>
    </div>
  );
}
