import { ArrowRight, Check, Crown, Gift, Sparkles, Zap, Building2, ShieldCheck, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { useSubscription, useUnitUsage, PLAN_UNIT_LIMITS, type PlanTier } from "@/hooks/useSubscription";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { SEO } from "@/components/SEO";

type Plan = {
  id: PlanTier;
  nameAr: string;
  nameEn: string;
  units: number;
  priceMonthly: number;
  priceYearly: number;
  priceIdMonthly?: string;
  priceIdYearly?: string;
  taglineAr: string;
  taglineEn: string;
  featuresAr: string[];
  featuresEn: string[];
  highlight?: boolean;
  icon: any;
};

const PLANS: Plan[] = [
  {
    id: "free",
    nameAr: "مجاني",
    nameEn: "Free",
    units: 5,
    priceMonthly: 0,
    priceYearly: 0,
    taglineAr: "للتجربة",
    taglineEn: "For trying out",
    icon: Sparkles,
    featuresAr: ["حتى 5 وحدات", "مباني غير محدودة", "تقارير أساسية", "دعم بالبريد"],
    featuresEn: ["Up to 5 units", "Unlimited buildings", "Basic reports", "Email support"],
  },
  {
    id: "starter",
    nameAr: "بداية",
    nameEn: "Starter",
    units: 25,
    priceMonthly: 10,
    priceYearly: 100,
    priceIdMonthly: "starter_monthly",
    priceIdYearly: "starter_yearly",
    taglineAr: "للملاك الجدد",
    taglineEn: "For new landlords",
    icon: Zap,
    featuresAr: ["حتى 25 وحدة", "مباني غير محدودة", "تقارير متقدمة", "تذكيرات تلقائية", "تصدير PDF"],
    featuresEn: ["Up to 25 units", "Unlimited buildings", "Advanced reports", "Auto reminders", "PDF export"],
  },
  {
    id: "pro",
    nameAr: "احترافي",
    nameEn: "Pro",
    units: 75,
    priceMonthly: 29,
    priceYearly: 290,
    priceIdMonthly: "pro_monthly",
    priceIdYearly: "pro_yearly",
    taglineAr: "الأكثر شعبية",
    taglineEn: "Most popular",
    highlight: true,
    icon: Crown,
    featuresAr: ["حتى 75 وحدة", "مباني غير محدودة", "فريق عمل", "مساعد ذكي AI", "نسخ احتياطي تلقائي", "أولوية الدعم"],
    featuresEn: ["Up to 75 units", "Unlimited buildings", "Team members", "AI assistant", "Auto backups", "Priority support"],
  },
  {
    id: "business",
    nameAr: "شركات",
    nameEn: "Business",
    units: 200,
    priceMonthly: 79,
    priceYearly: 790,
    priceIdMonthly: "business_monthly",
    priceIdYearly: "business_yearly",
    taglineAr: "للشركات الكبرى",
    taglineEn: "For enterprises",
    icon: Building2,
    featuresAr: ["حتى 200 وحدة", "مباني غير محدودة", "علامة تجارية مخصصة", "API مفتوح", "تكامل ZATCA"],
    featuresEn: ["Up to 200 units", "Unlimited buildings", "Custom branding", "Open API", "ZATCA integration"],
  },
  {
    id: "enterprise",
    nameAr: "مؤسسي",
    nameEn: "Enterprise",
    units: Infinity,
    priceMonthly: 199,
    priceYearly: 1990,
    priceIdMonthly: "enterprise_monthly",
    priceIdYearly: "enterprise_yearly",
    taglineAr: "وحدات بلا حدود",
    taglineEn: "Unlimited everything",
    icon: ShieldCheck,
    featuresAr: ["وحدات غير محدودة", "مدير حساب مخصص", "تكامل مخصص", "SLA 99.9%", "تدريب الفريق"],
    featuresEn: ["Unlimited units", "Dedicated manager", "Custom integrations", "99.9% SLA", "Team training"],
  },
];

export default function Pricing() {
  const { lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const ar = lang === "ar";
  const [yearly, setYearly] = useState(false);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const { openCheckout, loading: checkoutLoading } = usePaddleCheckout();
  const sub = useSubscription();
  const usage = useUnitUsage();

  const handleSelect = async (p: Plan) => {
    if (!user) {
      navigate(`/auth?mode=signup&plan=${p.id}`);
      return;
    }
    if (p.id === "free") {
      toast.info(ar ? "أنت على الخطة المجانية" : "You're on the Free plan");
      return;
    }
    const priceId = yearly ? p.priceIdYearly : p.priceIdMonthly;
    if (!priceId) return;
    try {
      await openCheckout({
        priceId,
        customerEmail: user?.email,
        customData: { userId: user?.id || "" },
        successUrl: `${window.location.origin}/pricing?checkout=success`,
      });
    } catch (e: any) {
      toast.error(e.message || "Checkout error");
    }
  };

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal", {
        body: { environment: sub.isActive ? undefined : "sandbox" },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
      else toast.error(ar ? "لا يوجد اشتراك نشط" : "No active subscription");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPortalLoading(false);
    }
  };

  const redeem = async () => {
    if (!code.trim()) return;
    setRedeeming(true);
    try {
      const { data, error } = await supabase.rpc("redeem_promo_code", { _code: code.trim() });
      if (error) throw error;
      const res = data as any;
      if (!res?.success) {
        const msgs: Record<string, { ar: string; en: string }> = {
          invalid_code: { ar: "كود غير صحيح", en: "Invalid code" },
          already_used: { ar: "هذا الكود مستخدم مسبقاً", en: "Code already used" },
          code_expired: { ar: "انتهت صلاحية الكود", en: "Code expired" },
          not_authenticated: { ar: "سجّل الدخول أولاً", en: "Sign in first" },
        };
        const m = msgs[res?.error] || { ar: "خطأ", en: "Error" };
        toast.error(ar ? m.ar : m.en);
        return;
      }
      const exp = new Date(res.expires_at).toLocaleDateString(ar ? "ar" : "en");
      toast.success(ar ? `تم التفعيل! ينتهي في ${exp}` : `Activated! Expires ${exp}`);
      setCode("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRedeeming(false);
    }
  };

  const usagePercent = sub.unitLimit === Infinity ? 0 : Math.min(100, Math.round((usage.unitCount / sub.unitLimit) * 100));
  const usageTextClass = usagePercent >= 100 ? "text-burgundy" : usagePercent >= 80 ? "text-terracotta" : "text-sage-500";
  const usageBarClass = usagePercent >= 100 ? "bg-burgundy" : usagePercent >= 80 ? "bg-terracotta" : "bg-sage-500";

  return (
    <div className="mobile-shell pb-24 bg-background">
      <SEO
        path="/pricing"
        title={ar ? "الأسعار · أملاكي" : "Pricing — Amlaki"}
        description={ar
          ? "اطّلع على خطط أملاكي وأسعارها — اشترك سنوياً ووفّر، أو ابدأ مجاناً."
          : "Compare Amlaki plans and pricing — save with yearly billing or start free."}
      />
      <PaymentTestModeBanner />
      {user ? (
        <TopBar />
      ) : (
        <header className="sticky top-0 z-30 glass border-b border-sage-200/40">
          <div className="flex items-center justify-between px-4 h-14">
            <Link to="/welcome" className="flex items-center gap-2">
              <Logo size={28} />
              <span className="font-black text-sage-600 text-lg tracking-tight">{ar ? "أملاكي" : "Amlaki"}</span>
            </Link>
            <Link to="/auth?mode=signin" className="text-sm font-bold text-sage-600 hover:underline">
              {ar ? "تسجيل الدخول" : "Sign in"}
            </Link>
          </div>
        </header>
      )}
      <div className="px-5 pt-2 flex items-center gap-2">
        <Link to={user ? "/settings" : "/welcome"} className="text-sage-500"><ArrowRight className="h-5 w-5 rtl:rotate-180" /></Link>
        <h1 className="text-2xl font-black text-sage-600">{ar ? "الخطط والأسعار" : "Plans & Pricing"}</h1>
      </div>

      <div className="px-5 mt-4 space-y-5">
        <p className="text-sm text-muted-foreground text-center">
          {ar ? "اختر الخطة المناسبة لعدد وحداتك — مباني غير محدودة في كل الخطط" : "Pick a plan by units — unlimited buildings on all tiers"}
        </p>

        {/* Trial banner */}
        {sub.isTrialing && sub.trialDaysLeft !== null && (
          <div className="rounded-2xl p-4 border-2 border-gold/40 bg-gradient-gold/10">
            <div className="flex items-center gap-2 text-gold font-bold text-sm">
              <Sparkles className="h-4 w-4" />
              {ar
                ? `تبقى ${sub.trialDaysLeft} يوم من تجربتك المجانية`
                : `${sub.trialDaysLeft} days left in your free trial`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {ar ? "ستبدأ الفوترة تلقائياً بعد انتهاء التجربة." : "Billing starts automatically when the trial ends."}
            </p>
          </div>
        )}

        {/* Current usage */}
        {user && !sub.loading && (
          <div className="rounded-2xl p-4 border-2 border-sage-200/40 bg-card">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {ar ? "خطتك الحالية" : "Current plan"}
                </div>
                <div className="font-black text-sage-600 capitalize">
                  {sub.plan === "free" ? (ar ? "مجاني" : "Free") : sub.plan}
                  {sub.isTrialing && <span className="ms-2 text-[10px] bg-gold/20 text-gold px-2 py-0.5 rounded-full font-bold">{ar ? "تجربة" : "TRIAL"}</span>}
                </div>
              </div>
              <div className="text-end">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {ar ? "الوحدات" : "Units"}
                </div>
                <div className={`font-black ${usageTextClass}`}>
                  {usage.unitCount}<span className="text-muted-foreground font-normal">/{sub.unitLimit === Infinity ? "∞" : sub.unitLimit}</span>
                </div>
              </div>
            </div>
            {sub.unitLimit !== Infinity && (
              <div className="h-1.5 rounded-full bg-sage-100 overflow-hidden">
                <div className={`h-full ${usageBarClass} transition-all`} style={{ width: `${usagePercent}%` }} />
              </div>
            )}
            {sub.paddleSubscriptionId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={openPortal}
                disabled={portalLoading}
                className="mt-3 w-full text-xs text-sage-500 hover:text-sage-600"
              >
                {portalLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : (ar ? "إدارة الاشتراك والفواتير" : "Manage subscription & invoices")}
              </Button>
            )}
          </div>
        )}

        {user && (
          <div className="rounded-2xl p-4 border-2 border-sage-200/40 bg-card">
            <div className="flex items-center gap-2 mb-2">
              <Gift className="h-4 w-4 text-sage-500" />
              <h3 className="font-bold text-sage-600 text-sm">{ar ? "هل لديك كود ترويجي؟" : "Have a promo code?"}</h3>
            </div>
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="AMLAKI-FREE-001"
                className="h-11 rounded-xl"
              />
              <Button onClick={redeem} disabled={redeeming || !code.trim()} className="h-11 px-5 rounded-xl bg-gradient-sage text-primary-foreground font-bold">
                {redeeming ? "..." : (ar ? "تفعيل" : "Redeem")}
              </Button>
            </div>
          </div>
        )}

        {/* Toggle */}
        <div className="flex justify-center">
          <div className="inline-flex bg-muted rounded-full p-1">
            <button
              onClick={() => setYearly(false)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${!yearly ? "bg-card text-sage-600 shadow-soft" : "text-muted-foreground"}`}
            >
              {ar ? "شهري" : "Monthly"}
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${yearly ? "bg-card text-sage-600 shadow-soft" : "text-muted-foreground"}`}
            >
              {ar ? "سنوي" : "Yearly"}
              <span className="ms-1.5 text-[9px] bg-gradient-gold text-primary-foreground px-1.5 py-0.5 rounded-full">-17%</span>
            </button>
          </div>
        </div>

        {PLANS.map((p) => {
          const Icon = p.icon;
          const price = yearly ? p.priceYearly : p.priceMonthly;
          const features = ar ? p.featuresAr : p.featuresEn;
          const isCurrent = sub.plan === p.id;
          const unitsLabel = p.units === Infinity
            ? (ar ? "وحدات غير محدودة" : "Unlimited units")
            : (ar ? `حتى ${p.units} وحدة` : `Up to ${p.units} units`);
          return (
            <div
              key={p.id}
              className={`rounded-3xl p-5 border-2 shadow-soft animate-float-up relative ${
                p.highlight
                  ? "border-sage-400 bg-gradient-to-br from-card to-sage-100/40"
                  : "border-sage-200/40 bg-card"
              }`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-gold text-primary-foreground text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full">
                  {ar ? "موصى به" : "Recommended"}
                </span>
              )}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className={`h-9 w-9 rounded-xl grid place-items-center ${p.highlight ? "bg-gradient-sage text-primary-foreground" : "bg-sage-100 text-sage-500"}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-black text-sage-600 flex items-center gap-2">
                        {ar ? p.nameAr : p.nameEn}
                        {isCurrent && <span className="text-[9px] bg-sage-200 text-sage-600 px-2 py-0.5 rounded-full">{ar ? "الحالية" : "Current"}</span>}
                      </h3>
                      <p className="text-[10px] text-muted-foreground">{unitsLabel}</p>
                    </div>
                  </div>
                </div>
                <div className="text-end">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-sage-600">${price}</span>
                    <span className="text-xs text-muted-foreground">/{yearly ? (ar ? "سنة" : "yr") : (ar ? "شهر" : "mo")}</span>
                  </div>
                  {p.id !== "free" && (
                    <p className="text-[10px] text-gold font-bold mt-0.5">
                      {ar ? "14 يوم تجربة مجانية" : "14-day free trial"}
                    </p>
                  )}
                </div>
              </div>

              <ul className="space-y-2 mb-4">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-sage-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sage-600">{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleSelect(p)}
                disabled={checkoutLoading || isCurrent}
                className={`w-full rounded-xl h-11 font-bold ${
                  p.highlight ? "bg-gradient-sage text-primary-foreground" : "bg-muted text-sage-600 hover:bg-sage-100"
                }`}
              >
                {checkoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> :
                  isCurrent ? (ar ? "خطتك الحالية" : "Current plan") :
                  p.id === "free" ? (ar ? "خطة مجانية" : "Free plan") :
                  (ar ? "ابدأ التجربة المجانية" : "Start free trial")}
              </Button>
            </div>
          );
        })}

        <p className="text-[11px] text-muted-foreground text-center px-4">
          {ar ? "يمكنك الإلغاء في أي وقت خلال التجربة دون أي رسوم. لا توجد رسوم خفية." : "Cancel anytime during the trial — no charges. No hidden fees."}
        </p>

        <div className="pt-2 pb-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
          <Link to="/terms" className="hover:text-sage-600">{ar ? "الشروط" : "Terms"}</Link>
          <Link to="/privacy" className="hover:text-sage-600">{ar ? "الخصوصية" : "Privacy"}</Link>
          <Link to="/refund" className="hover:text-sage-600">{ar ? "الاسترداد" : "Refund"}</Link>
        </div>
      </div>
      {user && <BottomNav />}
    </div>
  );
}
