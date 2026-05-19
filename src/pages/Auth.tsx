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
import { useT2 } from "@/lib/i18n2";
import { toast } from "sonner";

const ASCII_RE = /^[\x20-\x7E]*$/;
const REMEMBER_KEY = "remembered_email";

export default function Auth() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useI18n();
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
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { name },
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
