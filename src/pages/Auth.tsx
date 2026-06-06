import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Mail, Lock, User as UserIcon, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Logo } from "@/components/Logo";
import { useI18n } from "@/lib/i18n";
import { SEO } from "@/components/SEO";
import { useT2 } from "@/lib/i18n2";
import { toast } from "sonner";
import { isNativeApp, nativeGoogleSignIn } from "@/lib/nativeGoogleAuth";

const ASCII_RE = /^[\x20-\x7E]*$/;
const REMEMBER_KEY = "remembered_email";

export default function Auth() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const t2 = useT2();
  const [mode, setMode] = useState<"signin" | "signup">((params.get("mode") as any) || "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [pwError, setPwError] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) { setEmail(saved); setRemember(true); }
  }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ASCII_RE.test(password)) {
      setPwError(true);
      toast.error(t2("password_english_only"));
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const currentLang = (typeof window !== 'undefined' && localStorage.getItem('amlaki_lang')) || 'ar';
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { name, language: currentLang },
          },
        });
        if (error) throw error;
        toast.success(t("welcome") + ` ${name || ""}`.trim() + "!");
        if (remember) localStorage.setItem(REMEMBER_KEY, email); else localStorage.removeItem(REMEMBER_KEY);
        navigate("/");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (remember) localStorage.setItem(REMEMBER_KEY, email); else localStorage.removeItem(REMEMBER_KEY);
        navigate("/");
      }
    } catch (err: any) {
      toast.error(err.message || "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mobile-shell flex flex-col bg-background min-h-screen">
      <SEO
        path="/auth"
        title={lang === "ar" ? "تسجيل الدخول · أملاكي" : "Sign in — Amlaki"}
        description={lang === "ar"
          ? "سجّل دخولك إلى أملاكي أو أنشئ حساباً جديداً لإدارة عقاراتك."
          : "Sign in to Amlaki or create an account to manage your properties."}
      />
      <header className="flex items-center p-4 gap-2">
        <Link to="/welcome">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
          </Button>
        </Link>
      </header>

      <main className="flex-1 px-6 pb-10">
        <div className="flex flex-col items-center mb-8">
          <Logo size={56} />
          <h1 className="text-3xl font-black text-sage-600 mt-3">{t("app_name")}</h1>
        </div>

        <div className="bg-muted rounded-2xl p-1 flex mb-6">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                mode === m ? "bg-card text-sage-600 shadow-soft" : "text-muted-foreground"
              }`}
            >
              {m === "signin" ? t("sign_in") : t("sign_up")}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4 animate-float-up">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sage-600 font-semibold">{t("name")}</Label>
              <div className="relative">
                <UserIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="ps-10 h-12 rounded-xl bg-card border-sage-200" />
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sage-600 font-semibold">{t("email")}</Label>
            <div className="relative">
              <Mail className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="email" type="email" dir="ltr" lang="en" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="ps-10 h-12 rounded-xl bg-card border-sage-200" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sage-600 font-semibold">{t("password")}</Label>
            <div className="relative">
              <Lock className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type={showPw ? "text" : "password"}
                dir="ltr"
                lang="en"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => {
                  const v = e.target.value;
                  if (ASCII_RE.test(v)) { setPassword(v); setPwError(false); }
                  else { setPwError(true); }
                }}
                required
                minLength={6}
                className={`ps-10 pe-10 h-12 rounded-xl bg-card ${pwError ? "border-burgundy" : "border-sage-200"}`}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-sage-600"
                tabIndex={-1}
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {pwError && <p className="text-xs text-burgundy">{t2("password_english_only")}</p>}
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} />
              <span className="text-sm text-sage-600 font-medium">{t2("remember_me")}</span>
            </label>
            {mode === "signin" && (
              <Link to="/forgot-password" className="text-sm text-sage-600 font-medium hover:underline">
                {t2("forgot_password")}
              </Link>
            )}
          </div>

          <Button type="submit" disabled={busy} className="w-full h-13 py-3.5 rounded-2xl bg-gradient-sage text-primary-foreground font-semibold shadow-glow">
            {busy ? t("loading") : mode === "signup" ? t("sign_up") : t("sign_in")}
          </Button>

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-sage-200" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-background px-2 text-sage-500">{lang === "ar" ? "أو" : "or"}</span></div>
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                if (isNativeApp()) {
                  // Native iOS/Android: use Google SDK + Supabase signInWithIdToken
                  await nativeGoogleSignIn();
                  navigate("/");
                  return;
                }
                const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
                if (result.error) { toast.error(result.error.message || "Google sign-in failed"); setBusy(false); return; }
                if (result.redirected) return;
                navigate("/");
              } catch (err: any) {
                toast.error(err.message || "Google sign-in failed");
                setBusy(false);
              }
            }}
            className="w-full h-13 py-3.5 rounded-2xl border-sage-200 bg-card font-semibold flex items-center justify-center gap-3"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/>
            </svg>
            {lang === "ar" ? "المتابعة بحساب Google" : "Continue with Google"}
          </Button>
        </form>

        <footer className="mt-8 flex flex-wrap justify-center gap-x-4 gap-y-2 text-[11px] text-sage-500">
          <Link to="/pricing" className="hover:text-sage-600 font-medium">{t("pricing") || "Pricing"}</Link>
          <Link to="/terms" className="hover:text-sage-600">{t("terms") || "Terms"}</Link>
          <Link to="/privacy" className="hover:text-sage-600">{t("privacy") || "Privacy"}</Link>
          <Link to="/refund" className="hover:text-sage-600">{t("refund") || "Refund"}</Link>
        </footer>
      </main>
    </div>
  );
}
