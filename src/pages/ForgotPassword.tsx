import { useState } from "react";
import { Link } from "react-router-dom";
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
  const { t } = useI18n();
  const t2 = useT2();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success(t2("reset_email_sent"));
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
        </div>

        {sent ? (
          <div className="bg-card border border-sage-200 rounded-2xl p-6 text-center space-y-3">
            <p className="text-sage-600 font-medium">{t2("reset_email_sent")}</p>
            <Link to="/auth">
              <Button variant="outline" className="rounded-xl mt-2">{t("back")}</Button>
            </Link>
          </div>
        ) : (
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
        )}
      </main>
    </div>
  );
}
