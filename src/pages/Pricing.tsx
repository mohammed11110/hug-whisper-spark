import { ArrowRight, Check, Crown, Gift, Sparkles, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Plan = {
  id: "free" | "basic" | "pro" | "business";
  nameAr: string;
  nameEn: string;
  priceMonthly: number;
  priceYearly: number;
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
    priceMonthly: 0,
    priceYearly: 0,
    taglineAr: "للتجربة",
    taglineEn: "For trying out",
    icon: Sparkles,
    featuresAr: ["مبنى واحد", "5 وحدات كحد أقصى", "تقارير أساسية", "دعم بالبريد"],
    featuresEn: ["1 building", "Up to 5 units", "Basic reports", "Email support"],
  },
  {
    id: "basic",
    nameAr: "أساسي",
    nameEn: "Basic",
    priceMonthly: 9,
    priceYearly: 90,
    taglineAr: "للملاك الجدد",
    taglineEn: "For new landlords",
    icon: Zap,
    featuresAr: ["3 مباني", "30 وحدة", "تقارير متقدمة", "تذكيرات تلقائية", "تصدير PDF"],
    featuresEn: ["3 buildings", "30 units", "Advanced reports", "Auto reminders", "PDF export"],
  },
  {
    id: "pro",
    nameAr: "احترافي",
    nameEn: "Professional",
    priceMonthly: 29,
    priceYearly: 290,
    taglineAr: "الأكثر شعبية",
    taglineEn: "Most popular",
    highlight: true,
    icon: Crown,
    featuresAr: ["مباني غير محدودة", "وحدات غير محدودة", "فريق عمل", "مساعد ذكي AI", "نسخ احتياطي تلقائي", "أولوية الدعم"],
    featuresEn: ["Unlimited buildings", "Unlimited units", "Team members", "AI assistant", "Auto backups", "Priority support"],
  },
  {
    id: "business",
    nameAr: "شركات",
    nameEn: "Business",
    priceMonthly: 79,
    priceYearly: 790,
    taglineAr: "للشركات الكبرى",
    taglineEn: "For enterprises",
    icon: Crown,
    featuresAr: ["كل مزايا Pro", "علامة تجارية مخصصة", "API مفتوح", "تكامل ZATCA", "مدير حساب مخصص"],
    featuresEn: ["All Pro features", "Custom branding", "Open API", "ZATCA integration", "Dedicated manager"],
  },
];

export default function Pricing() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [yearly, setYearly] = useState(false);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  const handleSelect = (p: Plan) => {
    if (p.id === "free") {
      toast.info(ar ? "أنت على الخطة المجانية" : "You're on the Free plan");
      return;
    }
    toast.info(ar ? "سيتم تفعيل الدفع قريباً" : "Payments will be enabled soon");
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

  return (
    <div className="mobile-shell pb-24 bg-background">
      <TopBar />
      <div className="px-5 pt-2 flex items-center gap-2">
        <Link to="/settings" className="text-sage-500"><ArrowRight className="h-5 w-5 rtl:rotate-180" /></Link>
        <h1 className="text-2xl font-black text-sage-600">{ar ? "الخطط والأسعار" : "Plans & Pricing"}</h1>
      </div>

      <div className="px-5 mt-4 space-y-5">
        <p className="text-sm text-muted-foreground text-center">
          {ar ? "اختر الخطة المناسبة لحجم أعمالك" : "Choose the plan that fits your business"}
        </p>

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
          return (
            <div
              key={p.id}
              className={`rounded-3xl p-5 border-2 shadow-soft animate-float-up ${
                p.highlight
                  ? "border-sage-400 bg-gradient-to-br from-card to-sage-100/40 relative"
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
                      <h3 className="font-black text-sage-600">{ar ? p.nameAr : p.nameEn}</h3>
                      <p className="text-[10px] text-muted-foreground">{ar ? p.taglineAr : p.taglineEn}</p>
                    </div>
                  </div>
                </div>
                <div className="text-end">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-sage-600">${price}</span>
                    <span className="text-xs text-muted-foreground">/{yearly ? (ar ? "سنة" : "yr") : (ar ? "شهر" : "mo")}</span>
                  </div>
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
                className={`w-full rounded-xl h-11 font-bold ${
                  p.highlight ? "bg-gradient-sage text-primary-foreground" : "bg-muted text-sage-600 hover:bg-sage-100"
                }`}
              >
                {p.id === "free" ? (ar ? "خطتك الحالية" : "Current plan") : (ar ? "اختر الخطة" : "Choose plan")}
              </Button>
            </div>
          );
        })}

        <p className="text-[11px] text-muted-foreground text-center px-4">
          {ar ? "يمكنك الإلغاء في أي وقت. لا توجد رسوم خفية." : "Cancel anytime. No hidden fees."}
        </p>
      </div>
      <BottomNav />
    </div>
  );
}
