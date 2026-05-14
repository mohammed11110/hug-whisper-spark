import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { useI18n } from "@/lib/i18n";
import { useT2 } from "@/lib/i18n2";
import { toast } from "sonner";

const ASCII_RE = /^[\x20-\x7E]*$/;

export default function ResetPassword() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const t2 = useT2();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [pwError, setPwError] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ASCII_RE.test(pw)) {
      setPwError(true);
      toast.error(t2("password_english_only"));
      return;
    }
    if (pw !== pw2) {
      toast.error(t2("passwords_dont_match"));
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      toast.success(t2("password_updated"));
      navigate("/auth?mode=signin");
    } catch (err: any) {
      toast.error(err.message || "Error");
    } finally {
      setBusy(false);
    }
  };

  const onChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (ASCII_RE.test(v)) { setter(v); setPwError(false); }
    else setPwError(true);
  };

  return (
    <div className="mobile-shell flex flex-col bg-background min-h-screen">
      <main className="flex-1 px-6 py-10">
        <div className="flex flex-col items-center mb-8">
          <Logo size={56} />
          <h1 className="text-2xl font-black text-sage-600 mt-3">{t2("reset_password")}</h1>
        </div>
        <form onSubmit={submit} className="space-y-4 animate-float-up">
          <div className="space-y-1.5">
            <Label htmlFor="pw" className="text-sage-600 font-semibold">{t2("new_password")}</Label>
            <div className="relative">
              <Lock className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="pw" type={showPw ? "text" : "password"} dir="ltr" lang="en" autoComplete="new-password" value={pw} onChange={onChange(setPw)} required minLength={6} className={`ps-10 pe-10 h-12 rounded-xl bg-card ${pwError ? "border-burgundy" : "border-sage-200"}`} />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-sage-600" tabIndex={-1} aria-label={showPw ? "Hide password" : "Show password"}>
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw2" className="text-sage-600 font-semibold">{t2("confirm_password")}</Label>
            <div className="relative">
              <Lock className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="pw2" type={showPw2 ? "text" : "password"} dir="ltr" lang="en" autoComplete="new-password" value={pw2} onChange={onChange(setPw2)} required minLength={6} className={`ps-10 pe-10 h-12 rounded-xl bg-card ${pwError ? "border-burgundy" : "border-sage-200"}`} />
              <button type="button" onClick={() => setShowPw2((v) => !v)} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-sage-600" tabIndex={-1} aria-label={showPw2 ? "Hide password" : "Show password"}>
                {showPw2 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {pwError && <p className="text-xs text-burgundy">{t2("password_english_only")}</p>}
          <Button type="submit" disabled={busy} className="w-full h-13 py-3.5 rounded-2xl bg-gradient-sage text-primary-foreground font-semibold shadow-glow">
            {busy ? t("loading") : t2("reset_password")}
          </Button>
        </form>
      </main>
    </div>
  );
}
