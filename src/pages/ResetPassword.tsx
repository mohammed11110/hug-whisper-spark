import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Lock, Mail, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Logo } from "@/components/Logo";
import { useI18n } from "@/lib/i18n";
import { useT2 } from "@/lib/i18n2";
import { toast } from "sonner";

const ASCII_RE = /^[\x20-\x7E]*$/;

export default function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { t, lang } = useI18n();
  const t2 = useT2();

  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [pwError, setPwError] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [resending, setResending] = useState(false);

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
    if (code.length !== 6) {
      toast.error(lang === "ar" ? "أدخل الرمز المكوّن من 6 أرقام" : "Enter the 6-digit code");
      return;
    }
    setBusy(true);
    try {
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "recovery",
      });
      if (verifyErr) throw verifyErr;

      const { error: updateErr } = await supabase.auth.updateUser({ password: pw });
      if (updateErr) throw updateErr;

      toast.success(t2("password_updated"));
      await supabase.auth.signOut();
      navigate("/auth?mode=signin");
    } catch (err: any) {
      toast.error(err.message || "Error");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!email) {
      toast.error(lang === "ar" ? "أدخل البريد الإلكتروني" : "Enter your email");
      return;
    }
    setResending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      toast.success(t2("reset_email_sent"));
    } catch (err: any) {
      toast.error(err.message || "Error");
    } finally {
      setResending(false);
    }
  };

  const onChangePw = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (ASCII_RE.test(v)) { setter(v); setPwError(false); }
    else setPwError(true);
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
        <div className="flex flex-col items-center mb-6">
          <Logo size={56} />
          <h1 className="text-2xl font-black text-sage-600 mt-3">{t2("reset_password")}</h1>
          <p className="text-sm text-sage-500 mt-2 text-center max-w-xs">
            {lang === "ar"
              ? "أدخل الرمز المرسل إلى بريدك الإلكتروني، ثم اختر كلمة المرور الجديدة."
              : "Enter the code sent to your email, then choose a new password."}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4 animate-float-up">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sage-600 font-semibold">{t("email")}</Label>
            <div className="relative">
              <Mail className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                dir="ltr"
                lang="en"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="ps-10 h-12 rounded-xl bg-card border-sage-200"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sage-600 font-semibold">
              {lang === "ar" ? "رمز التحقق" : "Verification code"}
            </Label>
            <div className="flex justify-center" dir="ltr">
              <InputOTP maxLength={6} value={code} onChange={setCode} inputMode="numeric">
                <InputOTPGroup className="gap-1.5">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      className="h-12 w-10 rounded-xl border-sage-200 bg-card text-lg font-bold text-sage-600"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={resend}
                disabled={resending}
                className="text-xs text-sage-600 font-medium hover:underline disabled:opacity-50"
              >
                {resending
                  ? t("loading")
                  : lang === "ar" ? "إعادة إرسال الرمز" : "Resend code"}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pw" className="text-sage-600 font-semibold">{t2("new_password")}</Label>
            <div className="relative">
              <Lock className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="pw" type={showPw ? "text" : "password"} dir="ltr" lang="en" autoComplete="new-password" value={pw} onChange={onChangePw(setPw)} required minLength={6} className={`ps-10 pe-10 h-12 rounded-xl bg-card ${pwError ? "border-burgundy" : "border-sage-200"}`} />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-sage-600" tabIndex={-1} aria-label={showPw ? "Hide password" : "Show password"}>
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pw2" className="text-sage-600 font-semibold">{t2("confirm_password")}</Label>
            <div className="relative">
              <Lock className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="pw2" type={showPw2 ? "text" : "password"} dir="ltr" lang="en" autoComplete="new-password" value={pw2} onChange={onChangePw(setPw2)} required minLength={6} className={`ps-10 pe-10 h-12 rounded-xl bg-card ${pwError ? "border-burgundy" : "border-sage-200"}`} />
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
