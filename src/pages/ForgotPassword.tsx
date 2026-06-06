import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { useI18n } from "@/lib/i18n";
import { useT2 } from "@/lib/i18n2";
import { toast } from "sonner";

export default function ForgotPassword() {
  const { t, lang } = useI18n();
  const t2 = useT2();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      // No redirectTo → Supabase sends a 6-digit OTP code via email
      // instead of a magic link. This works in browsers and native apps.
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      toast.success(t2("reset_email_sent"));
      navigate(`/reset-password?email=${encodeURIComponent(email)}`);
    } catch (err: any) {
      toast.error(err.message || "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mobile-shell flex flex-col bg-background min-h-screen">
      <header className="flex items-center p-4 gap-2">
        <Link to="/auth">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
          </Button>
        </Link>
      </header>
      <main className="flex-1 px-6 pb-10">
        <div className="flex flex-col items-center mb-8">
          <Logo size={56} />
          <h1 className="text-2xl font-black text-sage-600 mt-3">{t2("reset_password")}</h1>
          <p className="text-sm text-sage-500 mt-2 text-center max-w-xs">
            {lang === "ar"
              ? "أدخل بريدك الإلكتروني وسنرسل لك رمزاً من 6 أرقام لإعادة التعيين."
              : "Enter your email and we'll send you a 6-digit code to reset your password."}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4 animate-float-up">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sage-600 font-semibold">{t("email")}</Label>
            <div className="relative">
              <Mail className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="email" type="email" dir="ltr" lang="en" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="ps-10 h-12 rounded-xl bg-card border-sage-200" />
            </div>
          </div>
          <Button type="submit" disabled={busy} className="w-full h-13 py-3.5 rounded-2xl bg-gradient-sage text-primary-foreground font-semibold shadow-glow">
            {busy ? t("loading") : t2("send_reset_link")}
          </Button>
        </form>
      </main>
    </div>
  );
}
