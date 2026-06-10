import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Mail, Lock, User as UserIcon, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Logo } from "@/components/Logo";
import { useI18n } from "@/lib/i18n";
import { SEO } from "@/components/SEO";
import { useT2 } from "@/lib/i18n2";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable";
import { isNative } from "@/lib/nativeFiles";
import { nativeGoogleSignIn, nativeAppleSignIn } from "@/lib/nativeGoogleAuth";

const ASCII_RE = /^[\x20-\x7E]*$/;
const REMEMBER_KEY = "remembered_email";

export default function Auth() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const t2 = useT2();
  const initialMode = (params.get("mode") as "signin" | "signup") || "signin";
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [showEmail, setShowEmail] = useState<boolean>(!!params.get("mode"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [pwError, setPwError] = useState(false);
  const native = isNative();

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) {
      setEmail(saved);
      setRemember(true);
    }
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
        const currentLang =
          (typeof window !== "undefined" && localStorage.getItem("amlaki_lang")) || "ar";
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
        if (remember) localStorage.setItem(REMEMBER_KEY, email);
        else localStorage.removeItem(REMEMBER_KEY);
        navigate("/");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (remember) localStorage.setItem(REMEMBER_KEY, email);
        else localStorage.removeItem(REMEMBER_KEY);
        navigate("/");
      }
    } catch (err: any) {
      toast.error(err.message || "Error");
    } finally {
      setBusy(false);
    }
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    // Platform policy: Google is web-only, Apple is app-only.
    if (isNative() && provider === "google") {
      toast.error("Google sign-in is available on the web only");
      return;
    }
    if (!isNative() && provider === "apple") {
      toast.error("Apple sign-in is available in the app only");
      return;
    }
    setBusy(true);
    try {
      // Native (iOS/Android): use the native SDKs so the OS shows the
      // system account picker / Face-ID sheet and returns an idToken
      // directly — no WebView redirect, no blank page.
      if (isNative()) {
        if (provider === "google") await nativeGoogleSignIn();
        else await nativeAppleSignIn();
        navigate("/");
        return;
      }

      // Web: use Lovable Managed OAuth (browser redirect flow).
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: `${window.location.origin}/`,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      navigate("/");
    } catch (err: any) {
      console.error(`[oauth:${provider}]`, err);
      toast.error(err?.message || `${provider} sign-in failed`);
      setBusy(false);
    }
  };


  return (
    <div className="mobile-shell flex flex-col bg-background min-h-screen">
      <SEO
        path="/auth"
        title={lang === "ar" ? "تسجيل الدخول · أملاكي" : "Sign in — Amlaki"}
        description={
          lang === "ar"
            ? "سجّل دخولك إلى أملاكي أو أنشئ حساباً جديداً لإدارة عقاراتك."
            : "Sign in to Amlaki or create an account to manage your properties."
        }
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
          <h1 className="text-3xl font-black text-foreground mt-3">{t("app_name")}</h1>
          <p className="text-sm text-muted-foreground mt-1 text-center">{t("tagline")}</p>
        </div>

        {!showEmail ? (
          <div className="space-y-3 animate-float-up">
            {/* Apple — app-only (iOS/Android). White button, black logo (Apple HIG) */}
            {native && (
              <Button
                type="button"
                disabled={busy}
                onClick={() => handleOAuth("apple")}
                className="w-full h-13 py-3.5 rounded-2xl bg-white text-black hover:bg-white/90 font-semibold flex items-center justify-center gap-3 shadow-soft"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                {t("continue_with_apple")}
              </Button>
            )}

            {/* Google — web-only. White button with official G logo */}
            {!native && (
              <Button
                type="button"
                disabled={busy}
                onClick={() => handleOAuth("google")}
                className="w-full h-13 py-3.5 rounded-2xl bg-white text-black hover:bg-white/90 font-semibold flex items-center justify-center gap-3 shadow-soft"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z" />
                </svg>
                {t("continue_with_google")}
              </Button>
            )}

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-background px-2 text-muted-foreground">
                  {t("auth_or_divider")}
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setShowEmail(true)}
              className="w-full h-13 py-3.5 rounded-2xl border-accent/40 text-accent font-semibold flex items-center justify-center gap-3"
            >
              <Mail className="h-5 w-5" />
              {t("continue_with_email")}
            </Button>

            <p className="text-xs text-muted-foreground text-center pt-2 leading-relaxed">
              {t("auth_privacy_note")}
            </p>
          </div>
        ) : (
          <>
            <div className="bg-muted rounded-2xl p-1 flex mb-6">
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    mode === m ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"
                  }`}
                >
                  {m === "signin" ? t("sign_in") : t("sign_up")}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-4 animate-float-up">
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-foreground font-semibold">
                    {t("name")}
                  </Label>
                  <div className="relative">
                    <UserIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="ps-10 h-12 rounded-xl bg-card"
                    />
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-foreground font-semibold">
                  {t("email")}
                </Label>
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
                    className="ps-10 h-12 rounded-xl bg-card"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-foreground font-semibold">
                  {t("password")}
                </Label>
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
                      if (ASCII_RE.test(v)) {
                        setPassword(v);
                        setPwError(false);
                      } else {
                        setPwError(true);
                      }
                    }}
                    required
                    minLength={6}
                    className={`ps-10 pe-10 h-12 rounded-xl bg-card ${
                      pwError ? "border-destructive" : ""
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {pwError && <p className="text-xs text-destructive">{t2("password_english_only")}</p>}
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} />
                  <span className="text-sm text-foreground font-medium">{t2("remember_me")}</span>
                </label>
                {mode === "signin" && (
                  <Link
                    to="/forgot-password"
                    className="text-sm text-accent font-medium hover:underline"
                  >
                    {t2("forgot_password")}
                  </Link>
                )}
              </div>

              <Button
                type="submit"
                disabled={busy}
                className="w-full h-13 py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold"
              >
                {busy ? t("loading") : mode === "signup" ? t("sign_up") : t("sign_in")}
              </Button>

              <button
                type="button"
                onClick={() => setShowEmail(false)}
                className="w-full text-sm text-muted-foreground hover:text-foreground py-2"
              >
                ← {native ? t("continue_with_apple") : t("continue_with_google")}
              </button>
            </form>
          </>
        )}

        <footer className="mt-8 flex flex-wrap justify-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
          <Link to="/pricing" className="hover:text-foreground font-medium">
            {t("pricing") || "Pricing"}
          </Link>
          <Link to="/terms" className="hover:text-foreground">
            {t("terms") || "Terms"}
          </Link>
          <Link to="/privacy" className="hover:text-foreground">
            {t("privacy") || "Privacy"}
          </Link>
          <Link to="/refund" className="hover:text-foreground">
            {t("refund") || "Refund"}
          </Link>
        </footer>
      </main>
    </div>
  );
}
