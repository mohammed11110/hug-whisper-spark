import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight, Clock, Coins, RotateCcw, Printer, ShieldAlert, MessageCircle, Bell,
  Database, Users, Image as ImageIcon, Smartphone, Globe, Moon, Sun, Monitor,
  Crown, Sparkles, LogOut, ChevronDown, Shield, User as UserIcon, Mail,
  CreditCard, Loader2,
} from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { getPaddleEnvironment } from "@/lib/paddle";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/lib/theme";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Textarea } from "@/components/ui/textarea";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { useCurrency, CURRENCIES } from "@/lib/currency";
import { useAppSettings, PAGE_SIZES_MM, type PageSize, formatReceipt } from "@/lib/appSettings";
import { useAuth } from "@/lib/auth";
import { useAdmin } from "@/lib/useAdmin";
import { DeleteAccountSection } from "@/components/DeleteAccountSection";
import { BusinessWhatsAppSection } from "@/components/BusinessWhatsAppSection";
import { toast } from "sonner";

const RETENTIONS = [
  { v: 0, key: "ret_off" },
  { v: 60, key: "ret_1h" },
  { v: 60 * 24, key: "ret_1d" },
  { v: 60 * 24 * 7, key: "ret_1w" },
  { v: -1, key: "ret_forever" },
];

const RET_LABELS: Record<string, { ar: string; en: string }> = {
  ret_off: { ar: "بدون حفظ", en: "Don't save" },
  ret_1h: { ar: "ساعة", en: "1 hour" },
  ret_1d: { ar: "يوم", en: "1 day" },
  ret_1w: { ar: "أسبوع", en: "1 week" },
  ret_forever: { ar: "دائماً", en: "Forever" },
};

const tr = (lang: string, ar: string, en: string) => (lang === "ar" ? ar : en);

export default function Settings() {
  const { t, lang } = useI18n();
  const { signOut, user } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const { currency, setCurrency } = useCurrency();
  const { settings, update, reset, resetReceiptNumber } = useAppSettings();
  const { theme, setTheme } = useTheme();
  const [openCurr, setOpenCurr] = useState(false);
  const [openAdvanced, setOpenAdvanced] = useState(false);
  const RL = (k: string) => RET_LABELS[k]?.[lang === "ar" ? "ar" : "en"] || k;
  const saved = () => toast.success(tr(lang, "تم الحفظ", "Saved"));
  const sub = useSubscription();
  const [portalLoading, setPortalLoading] = useState(false);

  const planLabel = (p: string) => {
    const map: Record<string, { ar: string; en: string }> = {
      free: { ar: "الخطة المجانية", en: "Free plan" },
      starter: { ar: "خطة Starter", en: "Starter plan" },
      pro: { ar: "خطة Pro", en: "Pro plan" },
      business: { ar: "خطة Business", en: "Business plan" },
      enterprise: { ar: "خطة Enterprise", en: "Enterprise plan" },
    };
    return (map[p] ?? map.free)[lang === "ar" ? "ar" : "en"];
  };

  const openPortal = async () => {
    if (sub.loading) return;
    if (!sub.paddleSubscriptionId) {
      toast.info(
        tr(lang, "لا يوجد اشتراك مدفوع بعد. اختر خطة للبدء.", "No paid subscription yet. Choose a plan to get started."),
        { action: { label: tr(lang, "الخطط", "Plans"), onClick: () => navigate("/pricing") } },
      );
      return;
    }
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal", {
        body: { environment: getPaddleEnvironment() },
      });
      if (error) throw error;
      if (!data?.url) {
        if ((data as any)?.error === "no_subscription") {
          toast.info(
            tr(lang, "لا يوجد اشتراك مدفوع بعد. اختر خطة للبدء.", "No paid subscription yet. Choose a plan to get started."),
            { action: { label: tr(lang, "الخطط", "Plans"), onClick: () => navigate("/pricing") } },
          );
          return;
        }
        throw new Error("no_url");
      }
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(tr(lang, "تعذّر فتح بوابة الإدارة. حاول مجدداً.", "Couldn't open the portal. Please try again."));
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="mobile-shell min-h-screen pb-24 bg-background">
      <TopBar />

      <div className="px-5 pt-2 flex items-center gap-2">
        <Link to="/" className="text-sage-500"><ArrowRight className="h-5 w-5 rtl:rotate-180" /></Link>
        <h1 className="text-2xl font-black text-sage-600">{tr(lang, "الإعدادات", "Settings")}</h1>
      </div>

      {/* === Admin Panel (admins only) === */}
      {isAdmin && (
        <section className="px-5 mt-5">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-burgundy" />
            <h2 className="font-bold text-burgundy text-sm">{tr(lang, "لوحة المسؤول", "Admin panel")}</h2>
          </div>
          <Link
            to="/admin"
            className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-burgundy/15 to-burgundy/5 border border-burgundy/30 p-4 shadow-soft hover:from-burgundy/20 transition"
          >
            <div className="p-2 rounded-xl bg-burgundy/20 text-burgundy"><Shield className="h-4 w-4" /></div>
            <div className="flex-1 text-start">
              <p className="font-bold text-sm text-burgundy">{tr(lang, "المستخدمون والاشتراكات", "Users & subscriptions")}</p>
              <p className="text-[11px] text-burgundy/70">{tr(lang, "إدارة الحسابات وأكواد الترويج", "Manage accounts & promo codes")}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-burgundy rtl:rotate-180" />
          </Link>
        </section>
      )}

      {/* === Account === */}
      <section className="px-5 mt-5">
        <div className="flex items-center gap-2 mb-2">
          <UserIcon className="h-4 w-4 text-sage-600" />
          <h2 className="font-bold text-sage-600 text-sm">{tr(lang, "الحساب", "Account")}</h2>
        </div>
        <div className="rounded-2xl bg-card shadow-soft border border-sage-200/50 divide-y divide-sage-100 overflow-hidden">
          {user?.email && (
            <div className="flex items-center gap-3 px-4 py-3">
              <Mail className="h-4 w-4 text-sage-500" />
              <span className="text-sm text-sage-600 font-semibold truncate flex-1">{user.email}</span>
            </div>
          )}
          <Link to="/pricing" className="flex items-center gap-3 px-4 py-3 hover:bg-sage-50 transition">
            <Crown className="h-4 w-4 text-sage-600" />
            <span className="flex-1 text-sm font-bold text-sage-600">{tr(lang, "الخطط والأسعار", "Plans & pricing")}</span>
            <ArrowRight className="h-4 w-4 text-sage-400 rtl:rotate-180" />
          </Link>
          <button
            onClick={openPortal}
            disabled={portalLoading || sub.loading}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-sage-50 transition disabled:opacity-60"
          >
            <CreditCard className="h-4 w-4 text-sage-600" />
            <div className="flex-1 text-start">
              <p className="text-sm font-bold text-sage-600">{tr(lang, "إدارة الاشتراك", "Manage subscription")}</p>
              <p className="text-[11px] text-muted-foreground">
                {sub.paddleSubscriptionId
                  ? planLabel(sub.plan)
                  : tr(lang, "أنت على الخطة المجانية", "You're on the Free plan")}
              </p>
            </div>
            {portalLoading ? (
              <Loader2 className="h-4 w-4 text-sage-400 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4 text-sage-400 rtl:rotate-180" />
            )}
          </button>
          <button
            onClick={async () => {
              await signOut();
              toast.success(tr(lang, "تم تسجيل الخروج", "Signed out"));
              navigate("/auth");
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-burgundy hover:bg-burgundy/5 transition"
          >
            <LogOut className="h-4 w-4" />
            <span className="flex-1 text-start text-sm font-bold">{tr(lang, "تسجيل الخروج", "Sign out")}</span>
          </button>
        </div>
      </section>

      <BusinessWhatsAppSection />

      {/* === Preferences === */}
      <section className="px-5 mt-6">
        <h2 className="font-bold text-sage-600 text-sm mb-2">{tr(lang, "التفضيلات", "Preferences")}</h2>

        {/* Language */}
        <div className="rounded-2xl bg-card shadow-soft p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-sage text-primary-foreground grid place-items-center shadow-soft">
              <Globe className="h-5 w-5" />
            </div>
            <p className="font-bold text-sm text-sage-600">{t("language")}</p>
          </div>
          <LanguageSwitcher variant="outline" />
        </div>

        {/* Currency */}
        <div className="rounded-2xl bg-card shadow-soft p-4 mt-2">
          <button onClick={() => setOpenCurr((v) => !v)} className="w-full flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-sage text-primary-foreground grid place-items-center shadow-soft">
                <Coins className="h-5 w-5" />
              </div>
              <div className="text-start">
                <p className="font-bold text-sm text-sage-600">{t("currency")}</p>
                <p className="text-[11px] text-muted-foreground">{currency.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-sage-600 text-sm">{currency.code}</span>
              <span className="font-bold text-sage-500">{currency.symbol}</span>
            </div>
          </button>
          {openCurr && (
            <div className="mt-3 max-h-72 overflow-y-auto rounded-2xl border border-sage-200/40 bg-background divide-y divide-sage-100">
              {CURRENCIES.map((c) => (
                <button
                  key={c.code}
                  onClick={() => { setCurrency(c.code); setOpenCurr(false); saved(); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm ${
                    c.code === currency.code ? "bg-sage-100/70" : "hover:bg-muted"
                  }`}
                >
                  <span className="font-mono font-bold w-14 text-start">{c.code}</span>
                  <span className="flex-1 text-start opacity-80">{c.name}</span>
                  <span className="font-semibold">{c.symbol}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme */}
        <div className="rounded-2xl bg-card shadow-soft p-4 mt-2">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-sage text-primary-foreground grid place-items-center shadow-soft">
              <Moon className="h-5 w-5" />
            </div>
            <p className="font-bold text-sm text-sage-600">{tr(lang, "المظهر", "Appearance")}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([
              { key: "light", icon: Sun, lbl: tr(lang, "فاتح", "Light") },
              { key: "dark", icon: Moon, lbl: tr(lang, "داكن", "Dark") },
              { key: "system", icon: Monitor, lbl: tr(lang, "النظام", "System") },
            ] as const).map(({ key, icon: Ic, lbl }) => {
              const active = theme === key;
              return (
                <button
                  key={key}
                  onClick={() => { setTheme(key); saved(); }}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-bold transition-all ${
                    active ? "bg-gradient-sage text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Ic className="h-4 w-4" />
                  {lbl}
                </button>
              );
            })}
          </div>
        </div>

        {/* AI floating button toggle */}
        <div className="rounded-2xl bg-card shadow-soft border border-sage-200/50 p-4 mt-2 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-sage-100 text-sage-600"><Sparkles className="h-4 w-4" /></div>
          <div className="flex-1">
            <p className="font-bold text-sm text-sage-600">{tr(lang, "زر المساعد الذكي العائم", "Floating AI button")}</p>
            <p className="text-[11px] text-muted-foreground">{tr(lang, "إظهار زر سريع للمساعد على الرئيسية", "Show quick AI button on dashboard")}</p>
          </div>
          <button
            onClick={() => { update({ showAiFab: !settings.showAiFab }); saved(); }}
            className={`relative w-11 h-6 rounded-full transition-colors ${settings.showAiFab ? "bg-sage-500" : "bg-muted"}`}
            aria-label="toggle ai fab"
          >
            <span className={`absolute top-0.5 ${settings.showAiFab ? "end-0.5" : "start-0.5"} h-5 w-5 rounded-full bg-white shadow-soft transition-all`} />
          </button>
        </div>
      </section>

      {/* === Business brand === */}
      <section className="px-5 mt-6">
        <div className="flex items-center gap-2 mb-2">
          <ImageIcon className="h-4 w-4 text-sage-600" />
          <h2 className="font-bold text-sage-600 text-sm">
            {tr(lang, "هوية الإيصالات والعقود", "Receipt & contract branding")}
          </h2>
        </div>
        <div className="bg-card border border-sage-200/50 rounded-2xl p-4 shadow-soft space-y-3">
          <p className="text-[10px] text-muted-foreground">
            {tr(lang, "تظهر هذه البيانات في رأس كل إيصال وعقد PDF.", "Shown in the header of every receipt and lease PDF.")}
          </p>
          <label className="block space-y-1">
            <span className="text-[11px] text-sage-500 font-semibold">{tr(lang, "اسم العمل", "Business name")}</span>
            <Input value={settings.brand.name}
              onChange={(e) => update({ brand: { ...settings.brand, name: e.target.value } })}
              className="rounded-xl border-sage-200 bg-card h-10" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1">
              <span className="text-[11px] text-sage-500 font-semibold">{tr(lang, "اسم المؤجِّر (عربي)", "Landlord name (Arabic)")}</span>
              <Input value={settings.brand.landlordName || ""}
                onChange={(e) => update({ brand: { ...settings.brand, landlordName: e.target.value } })}
                placeholder={tr(lang, "اختياري", "Optional")}
                dir="rtl"
                className="rounded-xl border-sage-200 bg-card h-10" />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] text-sage-500 font-semibold">{tr(lang, "اسم المؤجِّر (إنجليزي)", "Landlord name (English)")}</span>
              <Input value={settings.brand.landlordNameEn || ""}
                onChange={(e) => update({ brand: { ...settings.brand, landlordNameEn: e.target.value } })}
                placeholder={tr(lang, "اختياري", "Optional")}
                dir="ltr"
                className="rounded-xl border-sage-200 bg-card h-10" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1">
              <span className="text-[11px] text-sage-500 font-semibold">{tr(lang, "هاتف", "Phone")}</span>
              <Input value={settings.brand.phone}
                onChange={(e) => update({ brand: { ...settings.brand, phone: e.target.value } })}
                className="rounded-xl border-sage-200 bg-card h-10" />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] text-sage-500 font-semibold">{tr(lang, "العنوان", "Address")}</span>
              <Input value={settings.brand.address}
                onChange={(e) => update({ brand: { ...settings.brand, address: e.target.value } })}
                className="rounded-xl border-sage-200 bg-card h-10" />
            </label>
          </div>
          <div>
            <span className="text-[11px] text-sage-500 font-semibold block mb-1">{tr(lang, "الشعار (PNG/JPG)", "Logo (PNG/JPG)")}</span>
            <div className="flex items-center gap-3">
              {settings.brand.logo && (
                <img src={settings.brand.logo} alt="logo" className="h-12 w-12 object-contain rounded-lg border border-sage-200 bg-white p-1" />
              )}
              <input type="file" accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0]; if (!f) return;
                  if (f.size > 500_000) { toast.error(tr(lang, "الحد 500 كيلوبايت", "Max 500KB")); return; }
                  const reader = new FileReader();
                  reader.onload = () => { update({ brand: { ...settings.brand, logo: String(reader.result) } }); saved(); };
                  reader.readAsDataURL(f);
                }}
                className="text-xs text-sage-600 flex-1" />
              {settings.brand.logo && (
                <button onClick={() => update({ brand: { ...settings.brand, logo: null } })}
                  className="text-[11px] text-burgundy font-bold">×</button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* === Receipt numbering === */}
      <section className="px-5 mt-6">
        <div className="flex items-center gap-2 mb-2">
          <Printer className="h-4 w-4 text-sage-600" />
          <h2 className="font-bold text-sage-600 text-sm">
            {tr(lang, "ترقيم الإيصالات", "Receipt numbering")}
          </h2>
        </div>
        <div className="bg-card border border-sage-200/50 rounded-2xl p-4 shadow-soft space-y-3">
          <p className="text-[10px] text-muted-foreground">
            {tr(lang, "يُستخدم الرقم تلقائياً عند تسجيل دفعة جديدة، ويزداد بمقدار 1 بعد كل حفظ. يمكنك تعديله يدوياً وقت الإدخال.", "Used automatically on new payments and increments by 1 after each save. You can still edit it at entry time.")}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <label className="block space-y-1">
              <span className="text-[11px] text-sage-500 font-semibold">{tr(lang, "بادئة", "Prefix")}</span>
              <Input value={settings.receipt.prefix}
                onChange={(e) => update({ receipt: { ...settings.receipt, prefix: e.target.value } })}
                maxLength={10}
                className="rounded-xl border-sage-200 bg-card h-10" />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] text-sage-500 font-semibold">{tr(lang, "رقم البداية", "Start number")}</span>
              <Input type="number" min={0} value={settings.receipt.startNumber}
                onChange={(e) => {
                  const v = Math.max(0, Number(e.target.value) || 0);
                  const keepNext = settings.receipt.nextNumber > settings.receipt.startNumber;
                  update({ receipt: { ...settings.receipt, startNumber: v, nextNumber: keepNext ? settings.receipt.nextNumber : v } });
                }}
                className="rounded-xl border-sage-200 bg-card h-10" />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] text-sage-500 font-semibold">{tr(lang, "خانات", "Digits")}</span>
              <Input type="number" min={0} max={8} value={settings.receipt.padding}
                onChange={(e) => update({ receipt: { ...settings.receipt, padding: Math.max(0, Math.min(8, Number(e.target.value) || 0)) } })}
                className="rounded-xl border-sage-200 bg-card h-10" />
            </label>
          </div>
          <div className="flex items-center justify-between gap-2 bg-sage-50 rounded-xl px-3 py-2">
            <div className="text-[11px] text-sage-600">
              <div>{tr(lang, "الرقم التالي", "Next number")}: <b>{settings.receipt.nextNumber}</b></div>
              <div className="opacity-80">{tr(lang, "معاينة", "Preview")}: <span className="font-mono font-bold">{formatReceipt(settings.receipt)}</span></div>
            </div>
            <Button variant="outline" size="sm" onClick={() => { resetReceiptNumber(); saved(); }} className="rounded-lg h-8 text-xs">
              <RotateCcw className="h-3 w-3 me-1" /> {tr(lang, "إعادة ضبط", "Reset")}
            </Button>
          </div>
        </div>
      </section>

      {/* === Notifications & messages === */}
      <section className="px-5 mt-6">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="h-4 w-4 text-sage-600" />
          <h2 className="font-bold text-sage-600 text-sm">
            {tr(lang, "التنبيهات والرسائل", "Notifications & messages")}
          </h2>
        </div>
        <div className="bg-card border border-sage-200/50 rounded-2xl p-4 shadow-soft grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-[11px] text-sage-500 font-semibold">
              {tr(lang, "تنبيه قبل الاستحقاق (يوم)", "Days before due")}
            </span>
            <Input type="number" min={1} max={30} value={settings.upcomingDays}
              onChange={(e) => update({ upcomingDays: Math.max(1, parseInt(e.target.value) || 7) })}
              className="rounded-xl border-sage-200 bg-card h-10" />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-sage-500 font-semibold">
              {tr(lang, "تنبيه قبل انتهاء العقد (يوم)", "Days before contract end")}
            </span>
            <Input type="number" min={1} max={180} value={settings.contractWarnDays}
              onChange={(e) => update({ contractWarnDays: Math.max(1, parseInt(e.target.value) || 30) })}
              className="rounded-xl border-sage-200 bg-card h-10" />
          </label>
        </div>
        <div className="bg-card border border-sage-200/50 rounded-2xl p-4 shadow-soft space-y-3 mt-2">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-[#128C7E]" />
            <p className="font-bold text-sm text-sage-600">{tr(lang, "قوالب رسائل واتساب", "WhatsApp templates")}</p>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {tr(lang, "متغيرات: {tenant} {unit} {building} {amount} {date}", "Variables: {tenant} {unit} {building} {amount} {date}")}
          </p>
          {(["reminder", "late", "receipt"] as const).map((k) => (
            <label key={k} className="block space-y-1">
              <span className="text-[11px] text-sage-500 font-semibold">
                {k === "reminder" ? tr(lang, "تذكير عام", "Reminder") :
                 k === "late" ? tr(lang, "متأخر", "Late") :
                 tr(lang, "إيصال", "Receipt")}
              </span>
              <Textarea value={settings.templates[k]}
                onChange={(e) => update({ templates: { ...settings.templates, [k]: e.target.value } })}
                rows={3}
                className="rounded-xl border-sage-200 bg-card text-xs" />
            </label>
          ))}
        </div>
      </section>

      {/* === Security === */}
      <section className="px-5 mt-6">
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert className="h-4 w-4 text-burgundy" />
          <h2 className="font-bold text-sage-600 text-sm">{tr(lang, "الأمان", "Security")}</h2>
        </div>
        <div className="bg-card border border-sage-200/50 rounded-2xl p-4 shadow-soft space-y-2">
          <p className="font-bold text-sm text-sage-600">{tr(lang, "حماية الحذف برقم سري", "Delete protection PIN")}</p>
          <p className="text-[11px] text-muted-foreground">
            {tr(lang,
              "عند تفعيله، يطلب التطبيق هذا الرقم قبل حذف أي دفعة. اتركه فارغاً للتعطيل.",
              "When set, the app asks for this PIN before deleting any payment. Leave empty to disable.")}
          </p>
          <Input
            type="password"
            inputMode="numeric"
            maxLength={12}
            placeholder={tr(lang, "بدون رقم سري", "No PIN")}
            defaultValue={settings.deletePin || ""}
            onBlur={(e) => {
              const v = e.target.value.trim();
              update({ deletePin: v ? v : null });
              saved();
            }}
            className="rounded-xl border-sage-200 bg-card h-11 font-mono text-center tracking-[0.4em]"
          />
          {settings.deletePin && (
            <p className="text-[10px] text-sage-500 text-center">
              {tr(lang, "✓ الحماية مفعّلة", "✓ Protection enabled")}
            </p>
          )}
        </div>
      </section>

      {/* === Tools === */}
      <section className="px-5 mt-6 space-y-2">
        <h2 className="font-bold text-sage-600 text-sm mb-2">{tr(lang, "الأدوات", "Tools")}</h2>
        {[
          { to: "/team", icon: Users, ar: "الفريق والصلاحيات", en: "Team & roles", arS: "ادعُ محاسبين أو مدراء فرع", enS: "Invite accountants or managers" },
          { to: "/backup", icon: Database, ar: "النسخ الاحتياطي", en: "Backup & restore", arS: "تصدير واستعادة كل بياناتك", enS: "Export and restore all your data" },
          { to: "/assistant", icon: Sparkles, ar: "المساعد الذكي", en: "AI Assistant", arS: "اسأل عن عقاراتك واحصل على رؤى", enS: "Ask about your properties" },
          { to: "/install", icon: Smartphone, ar: "تثبيت التطبيق على الجوال", en: "Install on phone", arS: "افتحه من الشاشة الرئيسية كتطبيق", enS: "Launch like a native app" },
        ].map(({ to, icon: Ic, ar, en, arS, enS }) => (
          <Link key={to} to={to} className="flex items-center gap-3 bg-card border border-sage-200/60 rounded-2xl p-4 shadow-soft hover:bg-sage-50 transition">
            <div className="p-2 rounded-xl bg-sage-100 text-sage-600"><Ic className="h-4 w-4" /></div>
            <div className="flex-1 text-start">
              <p className="font-bold text-sm text-sage-600">{tr(lang, ar, en)}</p>
              <p className="text-[11px] text-muted-foreground">{tr(lang, arS, enS)}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-sage-500 rtl:rotate-180" />
          </Link>
        ))}
      </section>

      {/* === Advanced (collapsible) === */}
      <section className="px-5 mt-6">
        <button
          onClick={() => setOpenAdvanced((v) => !v)}
          className="w-full flex items-center justify-between bg-card border border-sage-200/50 rounded-2xl p-4 shadow-soft hover:bg-sage-50 transition"
        >
          <span className="font-bold text-sm text-sage-600">{tr(lang, "إعدادات متقدمة", "Advanced settings")}</span>
          <ChevronDown className={`h-4 w-4 text-sage-500 transition-transform ${openAdvanced ? "rotate-180" : ""}`} />
        </button>

        {openAdvanced && (
          <div className="mt-2 space-y-3">
            {/* Print layout */}
            <div className="bg-card border border-sage-200/50 rounded-2xl p-4 shadow-soft space-y-4">
              <div className="flex items-center gap-2">
                <Printer className="h-4 w-4 text-sage-500" />
                <p className="font-bold text-sm text-sage-600">{tr(lang, "نمط الطباعة", "Print layout")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">{tr(lang, "حجم الورق", "Page size")}</p>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(PAGE_SIZES_MM) as PageSize[]).map((s) => {
                    const active = settings.pageSize === s;
                    return (
                      <button
                        key={s}
                        onClick={() => { update({ pageSize: s }); saved(); }}
                        className={`px-2 py-2 rounded-xl text-xs font-bold transition-all ${
                          active ? "bg-gradient-sage text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {s}
                        <span className="block text-[9px] font-mono opacity-70 mt-0.5">
                          {PAGE_SIZES_MM[s].w}×{PAGE_SIZES_MM[s].h}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">{tr(lang, "الهوامش (مم)", "Margins (mm)")}</p>
                  <button
                    type="button"
                    onClick={() => {
                      const v = settings.margins.top;
                      update({ margins: { top: v, right: v, bottom: v, left: v } });
                    }}
                    className="text-[10px] font-bold text-sage-500 underline"
                  >
                    {tr(lang, "توحيد الجوانب", "Link all sides")}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(["top", "right", "bottom", "left"] as const).map((side) => (
                    <label key={side} className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-sage-500 w-12">
                        {tr(lang,
                          side === "top" ? "أعلى" : side === "right" ? "يمين" : side === "bottom" ? "أسفل" : "يسار",
                          side
                        )}
                      </span>
                      <Input
                        type="number"
                        min={0}
                        max={60}
                        value={settings.margins[side]}
                        onChange={(e) => {
                          const n = Math.max(0, Math.min(60, Number(e.target.value) || 0));
                          update({ margins: { ...settings.margins, [side]: n } });
                        }}
                        className="h-8 text-sm font-mono text-center"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Filter retention */}
            <div className="bg-card border border-sage-200/50 rounded-2xl p-4 shadow-soft">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-sage-500" />
                <p className="font-bold text-sm text-sage-600">{tr(lang, "مدة حفظ الفلاتر", "Filter retention")}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {RETENTIONS.map((r) => {
                  const active = settings.filterRetentionMin === r.v;
                  return (
                    <button
                      key={r.v}
                      onClick={() => { update({ filterRetentionMin: r.v }); saved(); }}
                      className={`px-2 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                        active ? "bg-gradient-sage text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {RL(r.key)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reset all */}
            <Button
              variant="outline"
              onClick={() => { reset(); saved(); }}
              className="w-full rounded-xl border-burgundy/30 text-burgundy hover:bg-burgundy/5"
            >
              <RotateCcw className="h-4 w-4 me-2" /> {tr(lang, "استعادة الافتراضيات", "Reset defaults")}
            </Button>
          </div>
        )}
      </section>

      {/* === Legal === */}
      <section className="px-5 mt-6">
        <h2 className="font-bold text-sage-600 text-sm mb-2">{tr(lang, "الصفحات القانونية", "Legal")}</h2>
        <div className="rounded-2xl bg-card shadow-soft divide-y divide-sage-100 overflow-hidden">
          {([
            { to: "/terms", ar: "شروط الاستخدام", en: "Terms of Service" },
            { to: "/privacy", ar: "سياسة الخصوصية", en: "Privacy Policy" },
            { to: "/refund", ar: "سياسة الاسترجاع", en: "Refund Policy" },
          ] as const).map((l) => (
            <Link key={l.to} to={l.to} className="flex items-center justify-between px-4 py-3 text-sm font-bold text-sage-600 hover:bg-sage-100/40">
              <span>{tr(lang, l.ar, l.en)}</span>
              <ArrowRight className="h-4 w-4 text-sage-400 rtl:rotate-180" />
            </Link>
          ))}
        </div>
      </section>

      <DeleteAccountSection />

      <BottomNav />
    </div>
  );
}
