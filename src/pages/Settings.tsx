import React, { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight, Coins, RotateCcw, Printer, ShieldAlert, MessageCircle, Bell,
  Database, Users, Image as ImageIcon, Smartphone, Globe, Moon, Sun, Monitor,
  Crown, Sparkles, LogOut, Shield, User as UserIcon, Mail,
  CreditCard, Loader2, Check, Upload, Download, Send, Palette, Eye, Trash2,
} from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { getPaddleEnvironment } from "@/lib/paddle";
import { supabase } from "@/integrations/supabase/client";
import { openExternal, saveJsonUniversal } from "@/lib/nativeFiles";
import { useTheme } from "@/lib/theme";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Textarea } from "@/components/ui/textarea";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useI18n } from "@/lib/i18n";
import { useCurrency, CURRENCIES } from "@/lib/currency";
import { useAppSettings, PAGE_SIZES_MM, type PageSize, formatReceipt } from "@/lib/appSettings";
import { useAuth } from "@/lib/auth";
import { useAdmin } from "@/lib/useAdmin";
import { DeleteAccountSection } from "@/components/DeleteAccountSection";
import { BillingStatusSection } from "@/components/BillingStatusSection";
import { EndTrialDialog } from "@/components/EndTrialDialog";
import { BusinessWhatsAppSection } from "@/components/BusinessWhatsAppSection";
import { fillTemplate } from "@/lib/whatsapp";
import { toast } from "sonner";

const tr = (lang: string, ar: string, en: string) => (lang === "ar" ? ar : en);

const TEMPLATE_VARS = ["tenant", "unit", "building", "amount", "remaining", "date", "month"] as const;
const SAMPLE_VARS: Record<string, string> = {
  tenant: "أحمد العامري",
  unit: "A-204",
  building: "برج المرجان",
  amount: "350 ر.ع",
  remaining: "0 ر.ع",
  date: new Date().toLocaleDateString(),
  month: new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" }),
};

const PREFIX_PRESETS = ["R-", "INV-", "RCT-", "PAY-"];

export default function Settings() {
  const { t, lang } = useI18n();
  const { signOut, user } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const { currency, setCurrency } = useCurrency();
  const { settings, update, reset, resetReceiptNumber, saveReceiptSettings, receiptCounterReady } = useAppSettings();
  const { theme, setTheme } = useTheme();
  const sub = useSubscription();

  const [portalLoading, setPortalLoading] = useState(false);
  const [endTrialOpen, setEndTrialOpen] = useState(false);
  const [currOpen, setCurrOpen] = useState(false);
  const [testTpl, setTestTpl] = useState<null | "reminder" | "late" | "receipt">(null);
  const fileImportRef = useRef<HTMLInputElement>(null);
  const logoDragRef = useRef<HTMLDivElement>(null);
  const [logoDrag, setLogoDrag] = useState(false);

  const planLabel = (p: string) => {
    const map: Record<string, { ar: string; en: string }> = {
      free: { ar: "الخطة المجانية", en: "Free plan" },
      personal: { ar: "خطة Personal", en: "Personal plan" },
      starter: { ar: "خطة Personal", en: "Personal plan" }, // legacy alias
      pro: { ar: "خطة Pro", en: "Pro plan" },
      business: { ar: "خطة Business", en: "Business plan" },
      enterprise: { ar: "خطة Enterprise", en: "Enterprise plan" },
    };
    return (map[p] ?? map.free)[lang === "ar" ? "ar" : "en"];
  };

  const openPortal = async () => {
    if (sub.loading) return;
    if (!sub.paddleSubscriptionId) {
      toast.info(tr(lang, "لا يوجد اشتراك مدفوع بعد.", "No paid subscription yet."), {
        action: { label: tr(lang, "الخطط", "Plans"), onClick: () => navigate("/pricing") },
      });
      return;
    }
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal", {
        body: { environment: getPaddleEnvironment() },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("no_url");
      await openExternal(data.url);
    } catch {
      toast.error(tr(lang, "تعذّر فتح بوابة الإدارة", "Couldn't open the portal"));
    } finally {
      setPortalLoading(false);
    }
  };

  // ---- Logo handling (drag & drop + file) — auto-resize to 1024x1024 PNG ----
  const handleLogoFile = async (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error(tr(lang, "صيغة غير مدعومة", "Unsupported format")); return; }
    if (f.size > 5_000_000) { toast.error(tr(lang, "الحد 5 ميجابايت", "Max 5MB")); return; }
    try {
      // Build a data URL without FileReader — it's missing in some
      // WKWebView/sandboxed iframe contexts.
      let src: string;
      if (typeof (f as any).arrayBuffer === "function") {
        const buf = await f.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          binary += String.fromCharCode.apply(
            null,
            Array.from(bytes.subarray(i, i + chunk)) as any
          );
        }
        src = `data:${f.type || "image/png"};base64,${btoa(binary)}`;
      } else {
        src = URL.createObjectURL(f);
      }
      const img = new Image();
      img.onload = () => {
        try {
          const SIZE = 1024;
          const canvas = document.createElement("canvas");
          canvas.width = SIZE; canvas.height = SIZE;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("canvas");
          ctx.clearRect(0, 0, SIZE, SIZE);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          const ratio = Math.min(SIZE / img.width, SIZE / img.height);
          const w = Math.round(img.width * ratio);
          const h = Math.round(img.height * ratio);
          const x = Math.round((SIZE - w) / 2);
          const y = Math.round((SIZE - h) / 2);
          ctx.drawImage(img, x, y, w, h);
          const out = canvas.toDataURL("image/png");
          update({ brand: { ...settings.brand, logo: out } });
          toast.success(tr(lang, "تم ضبط الشعار على 1024×1024", "Logo resized to 1024×1024"));
        } catch {
          toast.error(tr(lang, "تعذّر معالجة الصورة", "Couldn't process image"));
        } finally {
          if (src.startsWith("blob:")) URL.revokeObjectURL(src);
        }
      };
      img.onerror = () => {
        toast.error(tr(lang, "صورة غير صالحة", "Invalid image"));
        if (src.startsWith("blob:")) URL.revokeObjectURL(src);
      };
      img.src = src;
    } catch {
      toast.error(tr(lang, "تعذّر قراءة الملف", "Couldn't read file"));
    }
  };


  // ---- Receipt builder helpers ----
  // Live preview uses the *current saved* settings.
  const receiptPreview = useMemo(() => formatReceipt(settings.receipt), [settings.receipt]);

  // Simplified wizard: one input "first receipt number" → derive prefix/start/padding.
  // Examples:  "R-01001" → { prefix: "R-", start: 1001, padding: 4 }
  //            "INV-100" → { prefix: "INV-", start: 100, padding: 3 }
  //            "0001"    → { prefix: "",   start: 1,    padding: 4 }
  const composedReceipt = useMemo(() => {
    const base = formatReceipt(settings.receipt, settings.receipt.startNumber);
    // formatReceipt always inserts a leading 0 before the numeric block — strip it for editing.
    const m = base.match(/^(.*?)0(\d+)$/);
    return m ? `${m[1]}${m[2]}` : base;
  }, [settings.receipt]);

  const [receiptDraft, setReceiptDraft] = useState<string>(composedReceipt);
  const [savingReceipt, setSavingReceipt] = useState(false);

  // Keep draft synced when server reloads settings (initial fetch / external change).
  React.useEffect(() => { setReceiptDraft(composedReceipt); }, [composedReceipt]);

  const parseReceiptDraft = (raw: string) => {
    const v = (raw || "").trim();
    const m = v.match(/^(.*?)(\d+)$/);
    if (!m) return null;
    const prefix = m[1] || "";
    const numStr = m[2];
    const startNumber = Math.max(1, parseInt(numStr, 10) || 1);
    const padding = Math.min(6, Math.max(0, numStr.length));
    return { prefix, startNumber, padding };
  };

  const parsedDraft = useMemo(() => parseReceiptDraft(receiptDraft), [receiptDraft]);
  const draftDirty = useMemo(() => {
    if (!parsedDraft) return false;
    const r = settings.receipt;
    return parsedDraft.prefix !== (r.prefix || "")
      || parsedDraft.startNumber !== (r.startNumber || 1)
      || parsedDraft.padding !== (r.padding || 0);
  }, [parsedDraft, settings.receipt]);

  const draftPreview = useMemo(() => {
    if (!parsedDraft) return "—";
    return formatReceipt(
      { ...settings.receipt, prefix: parsedDraft.prefix, padding: parsedDraft.padding, startNumber: parsedDraft.startNumber, nextNumber: parsedDraft.startNumber },
      parsedDraft.startNumber,
    );
  }, [parsedDraft, settings.receipt]);

  const saveReceiptDraft = async () => {
    if (!parsedDraft || !draftDirty || savingReceipt) return;
    setSavingReceipt(true);
    const before = {
      prefix: settings.receipt.prefix || "",
      startNumber: settings.receipt.startNumber || 1,
      padding: settings.receipt.padding || 0,
    };
    try {
      update({ receipt: { ...settings.receipt, prefix: parsedDraft.prefix, padding: parsedDraft.padding, startNumber: parsedDraft.startNumber, nextNumber: parsedDraft.startNumber } });
      await saveReceiptSettings({ prefix: parsedDraft.prefix, padding: parsedDraft.padding, startNumber: parsedDraft.startNumber });
      // Reset counter so the new start applies immediately to future receipts.
      await resetReceiptNumber();

      // Fire-and-await confirmation email (non-blocking on failure).
      const recipient = user?.email;
      if (recipient) {
        try {
          await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "receipt-numbering-changed",
              recipientEmail: recipient,
              idempotencyKey: `receipt-num-change-${user?.id}-${Date.now()}`,
              templateData: {
                name: (user?.user_metadata as any)?.name || recipient,
                oldPrefix: before.prefix || "—",
                oldStart: String(before.startNumber),
                oldPadding: String(before.padding),
                newPrefix: parsedDraft.prefix || "—",
                newStart: String(parsedDraft.startNumber),
                newPadding: String(parsedDraft.padding),
                nextPreview: draftPreview,
                changedAt: new Date().toLocaleString(lang === "ar" ? "ar" : "en"),
              },
            },
          });
          toast.success(tr(lang, "تم الحفظ ✓ — أرسلنا تأكيداً إلى بريدك", "Saved ✓ — confirmation sent to your email"));
        } catch {
          toast.success(tr(lang, "تم الحفظ ✓", "Saved ✓"));
        }
      } else {
        toast.success(tr(lang, "تم الحفظ ✓", "Saved ✓"));
      }
    } catch {
      toast.error(tr(lang, "تعذّر الحفظ", "Couldn't save"));
    } finally {
      setSavingReceipt(false);
    }
  };


  // ---- Import / Export settings ----
  const exportSettings = async () => {
    await saveJsonUniversal(settings, `amlaki-settings-${new Date().toISOString().slice(0, 10)}.json`);
    toast.success(tr(lang, "تم تصدير الإعدادات", "Settings exported"));
  };
  const importSettings = async (f: File | undefined) => {
    if (!f) return;
    try {
      const txt = await f.text();
      const data = JSON.parse(txt);
      update(data);
      toast.success(tr(lang, "تم استيراد الإعدادات", "Settings imported"));
    } catch {
      toast.error(tr(lang, "ملف غير صالح", "Invalid file"));
    }
  };

  // ---- Template helpers ----
  const insertVar = (k: typeof TEMPLATE_VARS[number], which: "reminder" | "late" | "receipt") => {
    update({ templates: { ...settings.templates, [which]: settings.templates[which] + ` {${k}}` } });
  };
  const renderTpl = (k: "reminder" | "late" | "receipt") => fillTemplate(settings.templates[k], SAMPLE_VARS);

  // ---- PIN ----
  const setPin = (v: string) => {
    const clean = v.replace(/\D/g, "").slice(0, 4);
    update({ deletePin: clean.length === 4 ? clean : (clean ? clean : null) });
  };

  return (
    <div className="mobile-shell min-h-screen pb-24 md:pb-8 bg-background">
      <TopBar />

      {/* Header */}
      <div className="px-5 md:px-8 lg:px-12 pt-2 flex items-center gap-2">
        <Link to="/" className="text-sage-500"><ArrowRight className="h-5 w-5 rtl:rotate-180" /></Link>
        <h1 className="text-2xl font-black text-sage-600 flex-1">{tr(lang, "الإعدادات", "Settings")}</h1>
        <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-bold text-sage-500 bg-sage-100/70 rounded-full px-3 py-1">
          <Check className="h-3 w-3" /> {tr(lang, "حفظ تلقائي", "Auto-saved")}
        </span>
      </div>

      {/* Account hero card */}
      <section className="px-5 md:px-8 lg:px-12 mt-4">
        <div className="rounded-3xl bg-gradient-sage text-primary-foreground p-5 shadow-soft relative overflow-hidden">
          <div className="flex items-center gap-3 relative z-10">
            <div className="h-14 w-14 rounded-2xl bg-white/15 backdrop-blur grid place-items-center">
              <UserIcon className="h-7 w-7" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-base truncate">{user?.user_metadata?.name || user?.email}</p>
              <p className="text-[11px] opacity-85 truncate flex items-center gap-1">
                <Mail className="h-3 w-3" /> {user?.email}
              </p>
            </div>
            <div className="text-end">
              <span className={`inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                sub.plan && sub.plan !== "free" ? "bg-gold text-white" : "bg-white/15"
              }`}>
                {sub.plan && sub.plan !== "free" ? planLabel(sub.plan).replace(/^خطة |^.* /, "") : "FREE"}
              </span>
            </div>
          </div>
          <div className="flex gap-2 mt-4 relative z-10">
            <Button onClick={openPortal} disabled={portalLoading || sub.loading}
              className="flex-1 bg-white/15 hover:bg-white/25 text-primary-foreground border-0 rounded-xl h-10 backdrop-blur">
              {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4 me-2" />}
              {tr(lang, "إدارة الاشتراك", "Manage subscription")}
            </Button>
            <Button variant="ghost" onClick={async () => { await signOut(); navigate("/auth"); }}
              className="bg-white/10 hover:bg-white/20 text-primary-foreground rounded-xl h-10 px-3">
              <LogOut className="h-4 w-4 rtl:rotate-180" />
            </Button>
          </div>
        </div>
      </section>

      {/* Billing status */}
      <BillingStatusSection />

      {/* Free trial card */}
      {sub.isTrialing && (
        <section className="px-5 md:px-8 lg:px-12 mt-3">
          <div className="rounded-2xl bg-card border-2 border-gold/30 p-4">
            <div className="flex items-center gap-2 text-gold font-black text-sm">
              <Crown className="h-4 w-4" />
              {tr(
                lang,
                `تجربة مجانية — ${sub.trialDaysLeft ?? 0} يوم متبقي`,
                `Free trial — ${sub.trialDaysLeft ?? 0} day${(sub.trialDaysLeft ?? 0) === 1 ? "" : "s"} left`,
              )}
            </div>
            <p className="text-xs text-sage-500 mt-1.5 leading-relaxed">
              {tr(
                lang,
                "لا توجد فوترة تلقائية. لن تُحسب أي رسوم — للاستمرار بعد التجربة اختر خطة من صفحة الأسعار.",
                "No automatic billing. You won't be charged — pick a plan from Pricing to continue after the trial.",
              )}
            </p>
            <div className="flex gap-2 mt-3">
              <Button
                onClick={() => navigate("/pricing")}
                className="flex-1 bg-gold hover:bg-gold/90 text-white rounded-xl h-9 text-xs font-bold"
              >
                {tr(lang, "عرض الخطط", "View plans")}
              </Button>
              <Button
                variant="outline"
                onClick={() => setEndTrialOpen(true)}
                className="rounded-xl h-9 text-xs font-bold border-terracotta/40 text-terracotta hover:bg-terracotta/5"
              >
                {tr(lang, "إنهاء التجربة الآن", "End trial now")}
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Admin shortcut */}
      {isAdmin && (
        <section className="px-5 md:px-8 lg:px-12 mt-3">
          <Link to="/admin" className="flex items-center gap-3 rounded-2xl bg-burgundy/5 border border-burgundy/25 p-3 hover:bg-burgundy/10 transition">
            <div className="p-2 rounded-xl bg-burgundy/15 text-burgundy"><Shield className="h-4 w-4" /></div>
            <p className="flex-1 text-sm font-bold text-burgundy text-start">{tr(lang, "لوحة المسؤول", "Admin panel")}</p>
            <ArrowRight className="h-4 w-4 text-burgundy rtl:rotate-180" />
          </Link>
        </section>
      )}

      {/* Tabs */}
      <section className="px-5 md:px-8 lg:px-12 mt-5">
        <Tabs defaultValue="account" className="w-full">
          <TabsList className="grid grid-cols-5 w-full h-auto bg-sage-100/60 p-1 rounded-2xl">
            {[
              { v: "account", icon: UserIcon, ar: "الحساب", en: "Account" },
              { v: "brand", icon: Palette, ar: "الهوية", en: "Brand" },
              { v: "notify", icon: Bell, ar: "تنبيهات", en: "Alerts" },
              { v: "print", icon: Printer, ar: "طباعة", en: "Print" },
              { v: "secure", icon: ShieldAlert, ar: "أمان", en: "Security" },
            ].map(({ v, icon: Ic, ar, en }) => (
              <TabsTrigger key={v} value={v}
                className="flex flex-col gap-1 py-2 px-1 rounded-xl text-[10px] font-bold data-[state=active]:bg-card data-[state=active]:text-sage-600 data-[state=active]:shadow-soft">
                <Ic className="h-4 w-4" />
                {tr(lang, ar, en)}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ============== ACCOUNT ============== */}
          <TabsContent value="account" className="space-y-3 mt-4">
            <Card>
              <Row icon={Globe} title={t("language")}>
                <LanguageSwitcher variant="outline" />
              </Row>
            </Card>

            <Card>
              <button onClick={() => setCurrOpen(true)} className="w-full flex items-center gap-3 p-4 hover:bg-sage-50 rounded-2xl transition">
                <div className="w-10 h-10 rounded-2xl bg-gradient-sage text-primary-foreground grid place-items-center shadow-soft">
                  <Coins className="h-5 w-5" />
                </div>
                <div className="flex-1 text-start">
                  <p className="font-bold text-sm text-sage-600">{t("currency")}</p>
                  <p className="text-[11px] text-muted-foreground">{currency.name}</p>
                </div>
                <span className="font-mono font-bold text-sage-600 text-sm">{currency.code}</span>
                <span className="font-bold text-sage-500">{currency.symbol}</span>
              </button>
            </Card>

            <Card>
              <div className="p-4">
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
                      <button key={key} onClick={() => setTheme(key)}
                        className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-bold transition-all ${
                          active ? "bg-gradient-sage text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground"
                        }`}>
                        <Ic className="h-4 w-4" />{lbl}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Card>

            <Link to="/pricing" className="flex items-center gap-3 bg-card border border-sage-200/60 rounded-2xl p-4 shadow-soft hover:bg-sage-50">
              <div className="p-2 rounded-xl bg-gold/15 text-gold"><Crown className="h-4 w-4" /></div>
              <p className="flex-1 text-sm font-bold text-sage-600 text-start">{tr(lang, "الخطط والأسعار", "Plans & pricing")}</p>
              <ArrowRight className="h-4 w-4 text-sage-400 rtl:rotate-180" />
            </Link>
          </TabsContent>

          {/* ============== BRAND ============== */}
          <TabsContent value="brand" className="space-y-3 mt-4">
            <BusinessWhatsAppSection />

            <Card>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-sage-600" />
                  <p className="font-bold text-sm text-sage-600">
                    {tr(lang, "هوية الإيصالات والعقود", "Receipt & contract branding")}
                  </p>
                </div>

                {/* Drag & drop logo */}
                <div
                  ref={logoDragRef}
                  onDragOver={(e) => { e.preventDefault(); setLogoDrag(true); }}
                  onDragLeave={() => setLogoDrag(false)}
                  onDrop={(e) => {
                    e.preventDefault(); setLogoDrag(false);
                    handleLogoFile(e.dataTransfer.files?.[0]);
                  }}
                  className={`rounded-2xl border-2 border-dashed transition-all p-4 flex items-center gap-4 ${
                    logoDrag ? "border-sage-500 bg-sage-100/60" : "border-sage-200 bg-sage-50/40"
                  }`}
                >
                  <div className="h-16 w-16 rounded-full bg-card border border-sage-200 grid place-items-center overflow-hidden shadow-soft">
                    {settings.brand.logo
                      ? <img src={settings.brand.logo} alt="logo" className="h-full w-full object-contain p-1.5" />
                      : <ImageIcon className="h-6 w-6 text-sage-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-sage-600">
                      {tr(lang, "اسحب الشعار هنا", "Drop logo here")}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {tr(lang, "PNG / JPG حتى 500KB", "PNG / JPG up to 500KB")}
                    </p>
                    <label className="inline-block mt-1.5 text-[11px] font-bold text-sage-600 underline cursor-pointer">
                      {tr(lang, "أو اختر ملفاً", "or browse file")}
                      <input type="file" accept="image/*" hidden onChange={(e) => handleLogoFile(e.target.files?.[0] || undefined)} />
                    </label>
                  </div>
                  {settings.brand.logo && (
                    <button onClick={() => update({ brand: { ...settings.brand, logo: null } })}
                      className="p-2 rounded-lg text-burgundy hover:bg-burgundy/10" aria-label="remove logo">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <Field label={tr(lang, "اسم العمل", "Business name")}>
                  <Input value={settings.brand.name}
                    onChange={(e) => update({ brand: { ...settings.brand, name: e.target.value } })}
                    className="rounded-xl border-sage-200 bg-card h-10" />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label={tr(lang, "المؤجِّر (عربي)", "Landlord (AR)")}>
                    <Input value={settings.brand.landlordName || ""} dir="rtl"
                      onChange={(e) => update({ brand: { ...settings.brand, landlordName: e.target.value } })}
                      className="rounded-xl border-sage-200 bg-card h-10" />
                  </Field>
                  <Field label={tr(lang, "المؤجِّر (إنجليزي)", "Landlord (EN)")}>
                    <Input value={settings.brand.landlordNameEn || ""} dir="ltr"
                      onChange={(e) => update({ brand: { ...settings.brand, landlordNameEn: e.target.value } })}
                      className="rounded-xl border-sage-200 bg-card h-10" />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label={tr(lang, "هاتف", "Phone")}>
                    <Input value={settings.brand.phone}
                      onChange={(e) => update({ brand: { ...settings.brand, phone: e.target.value } })}
                      className="rounded-xl border-sage-200 bg-card h-10" />
                  </Field>
                  <Field label={tr(lang, "العنوان", "Address")}>
                    <Input value={settings.brand.address}
                      onChange={(e) => update({ brand: { ...settings.brand, address: e.target.value } })}
                      className="rounded-xl border-sage-200 bg-card h-10" />
                  </Field>
                </div>
              </div>
            </Card>

            {/* Live receipt preview */}
            <Card>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Eye className="h-4 w-4 text-sage-600" />
                  <p className="font-bold text-sm text-sage-600">{tr(lang, "معاينة الإيصال الحية", "Live receipt preview")}</p>
                </div>
                <div className="rounded-2xl bg-card border border-sage-200/70 p-5 shadow-inner">
                  <div className="flex items-center gap-3 pb-3 border-b border-sage-100">
                    {settings.brand.logo && <img src={settings.brand.logo} alt="" className="h-12 w-12 object-contain rounded-lg bg-card" />}
                    <div className="flex-1">
                      <p className="font-black text-sage-700">{settings.brand.name || "—"}</p>
                      {settings.brand.phone && <p className="text-[10px] text-sage-500">{settings.brand.phone}</p>}
                      {settings.brand.address && <p className="text-[10px] text-sage-500">{settings.brand.address}</p>}
                    </div>
                    <div className="text-end">
                      <p className="text-[9px] text-sage-400 uppercase">{tr(lang, "إيصال رقم", "Receipt #")}</p>
                      <p className="font-mono font-bold text-sage-700">{receiptCounterReady ? receiptPreview : "…"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3 text-[11px] text-sage-600">
                    <div><span className="text-sage-400">{tr(lang, "المستأجر", "Tenant")}: </span>{SAMPLE_VARS.tenant}</div>
                    <div><span className="text-sage-400">{tr(lang, "الوحدة", "Unit")}: </span>{SAMPLE_VARS.unit}</div>
                    <div><span className="text-sage-400">{tr(lang, "المبنى", "Building")}: </span>{SAMPLE_VARS.building}</div>
                    <div><span className="text-sage-400">{tr(lang, "المبلغ", "Amount")}: </span><b>{SAMPLE_VARS.amount}</b></div>
                  </div>
                  {(settings.brand.landlordName || settings.brand.landlordNameEn) && (
                    <p className="text-[10px] text-sage-400 mt-3 text-center">
                      {settings.brand.landlordName} · {settings.brand.landlordNameEn}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* ============== NOTIFY ============== */}
          <TabsContent value="notify" className="space-y-3 mt-4">
            <Card>
              <div className="p-4 grid grid-cols-2 gap-3">
                <Field label={tr(lang, "تنبيه قبل الاستحقاق (يوم)", "Days before due")}>
                  <Input type="number" min={1} max={30} value={settings.upcomingDays}
                    onChange={(e) => update({ upcomingDays: Math.max(1, parseInt(e.target.value) || 7) })}
                    className="rounded-xl border-sage-200 bg-card h-10" />
                </Field>
                <Field label={tr(lang, "قبل انتهاء العقد (يوم)", "Before contract end")}>
                  <Input type="number" min={1} max={180} value={settings.contractWarnDays}
                    onChange={(e) => update({ contractWarnDays: Math.max(1, parseInt(e.target.value) || 30) })}
                    className="rounded-xl border-sage-200 bg-card h-10" />
                </Field>
              </div>
            </Card>

            <Card>
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-sage-600" />
                  <p className="font-bold text-sm text-sage-600">{tr(lang, "قوالب رسائل واتساب", "WhatsApp templates")}</p>
                </div>
                {(["reminder", "late", "receipt"] as const).map((k) => (
                  <div key={k} className="space-y-2 pb-3 border-b border-sage-100 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-sage-600 font-bold">
                        {k === "reminder" ? tr(lang, "تذكير عام", "Reminder") :
                         k === "late" ? tr(lang, "متأخر", "Late") :
                         tr(lang, "إيصال", "Receipt")}
                      </span>
                      <button onClick={() => setTestTpl(k)}
                        className="text-[10px] font-bold text-sage-600 bg-sage-100 hover:bg-sage-200 rounded-full px-2.5 py-1 flex items-center gap-1">
                        <Send className="h-3 w-3" /> {tr(lang, "اختبار", "Test")}
                      </button>
                    </div>
                    <Textarea value={settings.templates[k]}
                      onChange={(e) => update({ templates: { ...settings.templates, [k]: e.target.value } })}
                      rows={3}
                      className="rounded-xl border-sage-200 bg-card text-xs" />
                    <div className="flex flex-wrap gap-1.5">
                      {TEMPLATE_VARS.map((v) => (
                        <button key={v} onClick={() => insertVar(v, k)}
                          className="text-[10px] font-mono font-bold text-sage-600 bg-sage-100/70 hover:bg-sage-200 rounded-md px-2 py-0.5">
                          {"{"}{v}{"}"}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* ============== PRINT ============== */}
          <TabsContent value="print" className="space-y-3 mt-4">
            <Card>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Printer className="h-4 w-4 text-sage-600" />
                  <p className="font-bold text-sm text-sage-600">{tr(lang, "حجم الورق", "Paper size")}</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(PAGE_SIZES_MM) as PageSize[]).map((s) => {
                    const active = settings.pageSize === s;
                    return (
                      <button key={s} onClick={() => update({ pageSize: s })}
                        className={`px-2 py-3 rounded-xl text-xs font-bold transition-all ${
                          active ? "bg-gradient-sage text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground"
                        }`}>
                        {s}
                        <span className="block text-[9px] font-mono opacity-70 mt-0.5">
                          {PAGE_SIZES_MM[s].w}×{PAGE_SIZES_MM[s].h}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {tr(lang, "هوامش 16 مم على جميع الجوانب.", "16mm margins on all sides.")}
                </p>
              </div>
            </Card>

            <Card>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Printer className="h-4 w-4 text-sage-600" />
                  <p className="font-bold text-sm text-sage-600">{tr(lang, "ترقيم الإيصالات", "Receipt numbering")}</p>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {tr(lang,
                    "اكتب أول رقم تريد أن يظهر على إيصالاتك. سنستخرج البادئة وعدد الخانات تلقائياً.",
                    "Type the first number you want to appear on your receipts. We'll detect the prefix and digit count automatically.")}
                </p>

                <Field label={tr(lang, "أول رقم على إيصالاتك", "Your first receipt number")}>
                  <Input
                    value={receiptDraft}
                    maxLength={20}
                    placeholder="R-01001"
                    onChange={(e) => setReceiptDraft(e.target.value)}
                    className="rounded-xl border-sage-200 bg-card h-12 font-mono text-base font-bold text-center tracking-wider"
                    dir="ltr"
                  />
                </Field>

                <div className="flex items-center justify-between gap-2 bg-sage-100/70 rounded-xl px-4 py-3">
                  <div className="text-[11px] text-sage-600">
                    <p className="opacity-70">{tr(lang, "هكذا سيظهر", "It will look like")}</p>
                    <p className="font-mono font-black text-lg text-sage-700">{receiptCounterReady && parsedDraft ? draftPreview : "…"}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={saveReceiptDraft}
                    disabled={!receiptCounterReady || !parsedDraft || !draftDirty || savingReceipt}
                    className="rounded-lg h-9 text-xs bg-sage-500 hover:bg-sage-600 text-white disabled:opacity-50"
                  >
                    {savingReceipt
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <><Check className="h-3.5 w-3.5 me-1" /> {tr(lang, "حفظ التغيير", "Save change")}</>
                    }
                  </Button>
                </div>

                {!parsedDraft && receiptDraft && (
                  <p className="text-[11px] text-burgundy">
                    {tr(lang, "يجب أن ينتهي الرقم بأرقام (مثال: R-01001).", "The value must end with digits (e.g. R-01001).")}
                  </p>
                )}

                <div className="flex items-start gap-2 bg-sage-50 border border-sage-100 rounded-xl px-3 py-2.5">
                  <Mail className="h-3.5 w-3.5 text-sage-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-sage-600 leading-relaxed">
                    {tr(lang,
                      "لحماية حسابك: سيصلك إيميل تأكيد على بريد حسابك في كل مرة يتغيّر فيها ترقيم الإيصالات.",
                      "For your security: a confirmation email is sent to your account address every time the receipt numbering changes.")}
                  </p>
                </div>

                <details className="text-[11px] text-sage-500">
                  <summary className="cursor-pointer hover:text-sage-700 transition">
                    {tr(lang, "خيارات متقدمة", "Advanced")}
                  </summary>
                  <div className="mt-2 flex items-center justify-between gap-2 bg-card border border-sage-100 rounded-xl px-3 py-2">
                    <span>{tr(lang, "إعادة العداد إلى رقم البداية", "Reset counter to start number")}</span>
                    <Button variant="outline" size="sm" onClick={() => resetReceiptNumber()}
                      className="rounded-lg h-7 text-[11px] border-sage-300">
                      <RotateCcw className="h-3 w-3 me-1" /> {tr(lang, "صفر", "Reset")}
                    </Button>
                  </div>
                </details>
              </div>
            </Card>

          </TabsContent>

          {/* ============== SECURE ============== */}
          <TabsContent value="secure" className="space-y-3 mt-4">
            <Card>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-sage-600" />
                  <p className="font-bold text-sm text-sage-600">{tr(lang, "رمز حماية الحذف (PIN)", "Delete PIN")}</p>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {tr(lang, "أربعة أرقام تُطلب قبل أي حذف. اترك الحقل فارغاً للتعطيل.",
                            "Four digits required before any deletion. Clear to disable.")}
                </p>
                <div className="flex justify-center py-2" dir="ltr">
                  <InputOTP maxLength={4} value={settings.deletePin || ""} onChange={setPin}>
                    <InputOTPGroup>
                      {[0, 1, 2, 3].map((i) => (
                        <InputOTPSlot key={i} index={i}
                          className="h-12 w-12 mx-1 first:ms-0 last:me-0 rounded-xl border-sage-200 text-lg font-bold first:rounded-xl last:rounded-xl border" />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                {settings.deletePin?.length === 4 && (
                  <p className="text-[11px] text-sage-600 text-center flex items-center justify-center gap-1">
                    <Check className="h-3 w-3" /> {tr(lang, "الحماية مفعّلة", "Protection enabled")}
                  </p>
                )}
                {settings.deletePin && (
                  <Button variant="ghost" size="sm" onClick={() => update({ deletePin: null })}
                    className="w-full text-burgundy hover:bg-burgundy/5 text-xs">
                    {tr(lang, "تعطيل الحماية", "Disable protection")}
                  </Button>
                )}
              </div>
            </Card>

            <Card>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-sage-600" />
                  <p className="font-bold text-sm text-sage-600">{tr(lang, "نسخ احتياطي للإعدادات", "Settings backup")}</p>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {tr(lang, "احفظ إعداداتك كملف JSON أو استعدها على جهاز آخر.",
                            "Save your settings as JSON or restore on another device.")}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={exportSettings} className="rounded-xl border-sage-300 text-sage-600">
                    <Download className="h-4 w-4 me-2" /> {tr(lang, "تصدير", "Export")}
                  </Button>
                  <Button variant="outline" onClick={() => fileImportRef.current?.click()} className="rounded-xl border-sage-300 text-sage-600">
                    <Upload className="h-4 w-4 me-2" /> {tr(lang, "استيراد", "Import")}
                  </Button>
                  <input ref={fileImportRef} type="file" accept="application/json" hidden
                    onChange={(e) => importSettings(e.target.files?.[0] || undefined)} />
                </div>
                <Button variant="outline" onClick={() => { if (confirm(tr(lang, "استعادة الإعدادات الافتراضية؟", "Reset to defaults?"))) { reset(); toast.success(tr(lang, "تمت الاستعادة", "Reset done")); } }}
                  className="w-full rounded-xl border-burgundy/30 text-burgundy hover:bg-burgundy/5">
                  <RotateCcw className="h-4 w-4 me-2" /> {tr(lang, "استعادة الافتراضيات", "Reset defaults")}
                </Button>
                <Button variant="outline" onClick={async () => {
                  const { resetFabPosition } = await import("@/components/QuickAddPaymentFab");
                  resetFabPosition();
                  toast.success(tr(lang, "تمت إعادة موضع زر الدفع", "Payment button position reset"));
                }} className="w-full rounded-xl border-sage-300 text-sage-600">
                  <RotateCcw className="h-4 w-4 me-2" /> {tr(lang, "إعادة موضع زر الدفع العائم", "Reset floating payment button")}
                </Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </section>

      {/* Tools */}
      <section className="px-5 md:px-8 lg:px-12 mt-6 space-y-2">
        <h2 className="font-bold text-sage-600 text-sm mb-2">{tr(lang, "الأدوات", "Tools")}</h2>
        {[
          { to: "/team", icon: Users, ar: "الفريق والصلاحيات", en: "Team & roles" },
          { to: "/backup", icon: Database, ar: "النسخ الاحتياطي", en: "Backup & restore" },
          
          { to: "/install", icon: Smartphone, ar: "تثبيت التطبيق", en: "Install app" },
        ].map(({ to, icon: Ic, ar, en }) => (
          <Link key={to} to={to} className="flex items-center gap-3 bg-card border border-sage-200/60 rounded-2xl p-3.5 shadow-soft hover:bg-sage-50 transition">
            <div className="p-2 rounded-xl bg-sage-100 text-sage-600"><Ic className="h-4 w-4" /></div>
            <p className="flex-1 text-sm font-bold text-sage-600 text-start">{tr(lang, ar, en)}</p>
            <ArrowRight className="h-4 w-4 text-sage-400 rtl:rotate-180" />
          </Link>
        ))}
      </section>

      {/* Legal */}
      <section className="px-5 md:px-8 lg:px-12 mt-6">
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
      <EndTrialDialog open={endTrialOpen} onOpenChange={setEndTrialOpen} onEnded={() => sub.refresh()} />

      {/* Currency Sheet */}
      <Sheet open={currOpen} onOpenChange={setCurrOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl border-0 max-w-[430px] mx-auto p-0 max-h-[80vh] flex flex-col">
          <SheetHeader className="p-5 border-b border-sage-100">
            <SheetTitle className="text-sage-600 text-start">{tr(lang, "اختر العملة", "Choose currency")}</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto flex-1 p-2">
            {CURRENCIES.map((c) => (
              <button key={c.code}
                onClick={() => { setCurrency(c.code); setCurrOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm ${
                  c.code === currency.code ? "bg-gradient-sage text-primary-foreground" : "hover:bg-muted"
                }`}>
                <span className="font-mono font-bold w-14 text-start">{c.code}</span>
                <span className="flex-1 text-start opacity-90">{c.name}</span>
                <span className="font-bold">{c.symbol}</span>
                {c.code === currency.code && <Check className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Template test dialog */}
      <Dialog open={!!testTpl} onOpenChange={(o) => !o && setTestTpl(null)}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sage-600 text-start flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-[#128C7E]" />
              {tr(lang, "معاينة الرسالة", "Message preview")}
            </DialogTitle>
          </DialogHeader>
          {testTpl && (
            <div className="rounded-2xl bg-[#e7f8d9] border border-sage-200 p-4 text-sm text-sage-700 whitespace-pre-line shadow-inner">
              {renderTpl(testTpl)}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground text-center">
            {tr(lang, "بيانات تجريبية للمعاينة فقط", "Sample data for preview only")}
          </p>
          <DialogFooter>
            <Button onClick={() => setTestTpl(null)} className="w-full rounded-xl bg-gradient-sage">
              {tr(lang, "تم", "Done")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ===== Small composables ===== */

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-card border border-sage-200/50 shadow-soft overflow-hidden">{children}</div>;
}

function Row({ icon: Ic, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="w-10 h-10 rounded-2xl bg-gradient-sage text-primary-foreground grid place-items-center shadow-soft">
        <Ic className="h-5 w-5" />
      </div>
      <p className="font-bold text-sm text-sage-600 flex-1">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] text-sage-500 font-semibold">{label}</span>
      {children}
    </label>
  );
}
