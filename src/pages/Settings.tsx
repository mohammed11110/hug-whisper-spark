import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Palette, Clock, Coins, RotateCcw, Eye, Printer, ShieldAlert, MessageCircle, Bell, Database, Users, Image as ImageIcon, Smartphone, Globe, Moon, Sun, Monitor, Crown, Sparkles } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Textarea } from "@/components/ui/textarea";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { useT2 } from "@/lib/i18n2";
import { useCurrency, CURRENCIES } from "@/lib/currency";
import { useAppSettings, PAGE_SIZES_MM, type PageSize } from "@/lib/appSettings";
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

const SETTINGS_LABELS: Record<string, { ar: string; en: string }> = {
  page_title: { ar: "الإعدادات", en: "Settings" },
  currency_section: { ar: "العملة والتنسيق", en: "Currency & Format" },
  status_colors: { ar: "ألوان حالة الدفع", en: "Payment status colors" },
  filter_retention: { ar: "مدة حفظ الفلاتر", en: "Filter retention" },
  reset_defaults: { ar: "استعادة الافتراضيات", en: "Reset defaults" },
  bg_color: { ar: "الخلفية", en: "Background" },
  fg_color: { ar: "النص", en: "Text" },
  preview: { ar: "معاينة", en: "Preview" },
  paid: { ar: "مدفوع", en: "Paid" },
  late: { ar: "متأخر", en: "Late" },
  soon: { ar: "قريباً", en: "Soon" },
  saved: { ar: "تم الحفظ", en: "Saved" },
  live_preview: { ar: "معاينة مباشرة للإيصال", en: "Live receipt preview" },
  sample_tenant: { ar: "محمد العامري", en: "Sample Tenant" },
  sample_building: { ar: "برج أملاكي", en: "Amlaki Tower" },
  print_layout: { ar: "نمط الطباعة", en: "Print layout" },
  page_size: { ar: "حجم الورق", en: "Page size" },
  margins: { ar: "الهوامش", en: "Margins" },
  mm: { ar: "مم", en: "mm" },
  margin_top: { ar: "أعلى", en: "Top" },
  margin_right: { ar: "يمين", en: "Right" },
  margin_bottom: { ar: "أسفل", en: "Bottom" },
  margin_left: { ar: "يسار", en: "Left" },
  link_all: { ar: "توحيد الجوانب", en: "Link all sides" },
};

export default function Settings() {
  const { t, lang } = useI18n();
  const t2 = useT2();
  const { currency, setCurrency, format } = useCurrency();
  const { settings, update, setStatusColor, reset } = useAppSettings();
  const L = (k: string) => SETTINGS_LABELS[k]?.[lang === "ar" ? "ar" : "en"] || SETTINGS_LABELS[k]?.en || k;
  const RL = (k: string) => RET_LABELS[k]?.[lang === "ar" ? "ar" : "en"] || RET_LABELS[k]?.en || k;
  const [openCurr, setOpenCurr] = useState(false);
  const { theme, setTheme } = useTheme();
  const [previewStatus, setPreviewStatus] = useState<"paid" | "late" | "soon">("paid");
  const pc = settings.statusColors[previewStatus];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mobile-shell min-h-screen pb-24 bg-background">
      <TopBar />

      <div className="px-5 pt-2 flex items-center gap-2">
        <Link to="/" className="text-sage-500"><ArrowRight className="h-5 w-5 rtl:rotate-180" /></Link>
        <h1 className="text-2xl font-black text-sage-600">{L("page_title")}</h1>
      </div>

      {/* Language */}
      <section className="px-5 mt-5">
        <div className="rounded-3xl bg-card shadow-soft p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-sage text-primary-foreground grid place-items-center shadow-soft">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-sage-600">{t("language")}</p>
              <p className="text-[11px] text-muted-foreground">{lang === "ar" ? "اختر لغة التطبيق" : "Choose app language"}</p>
            </div>
          </div>
          <LanguageSwitcher variant="outline" />
        </div>
      </section>

      {/* Currency (next to language) */}
      <section className="px-5 mt-3">
        <div className="rounded-3xl bg-card shadow-soft p-4">
          <button
            onClick={() => setOpenCurr((v) => !v)}
            className="w-full flex items-center justify-between gap-3"
          >
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
                  onClick={() => { setCurrency(c.code); setOpenCurr(false); toast.success(L("saved")); }}
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
      </section>

      {/* Theme */}
      <section className="px-5 mt-3">
        <div className="rounded-3xl bg-card shadow-soft p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-sage text-primary-foreground grid place-items-center shadow-soft">
              <Moon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-sage-600">{lang === "ar" ? "المظهر" : "Appearance"}</p>
              <p className="text-[11px] text-muted-foreground">{lang === "ar" ? "فاتح، داكن، أو حسب النظام" : "Light, dark, or system"}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([
              { key: "light", icon: Sun, lbl: lang === "ar" ? "فاتح" : "Light" },
              { key: "dark", icon: Moon, lbl: lang === "ar" ? "داكن" : "Dark" },
              { key: "system", icon: Monitor, lbl: lang === "ar" ? "النظام" : "System" },
            ] as const).map(({ key, icon: Ic, lbl }) => {
              const active = theme === key;
              return (
                <button
                  key={key}
                  onClick={() => { setTheme(key); toast.success(L("saved")); }}
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
      </section>

      {/* Pricing & AI quick links */}
      <section className="px-5 mt-3 space-y-2">
        <Link to="/pricing" className="flex items-center gap-3 rounded-3xl bg-gradient-gold p-4 shadow-soft text-primary-foreground">
          <div className="p-2 rounded-xl bg-card/15"><Crown className="h-4 w-4" /></div>
          <div className="flex-1 text-start">
            <p className="font-bold text-sm">{lang === "ar" ? "الخطط والأسعار" : "Plans & Pricing"}</p>
            <p className="text-[11px] opacity-80">{lang === "ar" ? "ترقّ لإمكانات احترافية" : "Upgrade for pro features"}</p>
          </div>
          <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        </Link>
        <Link to="/assistant" className="flex items-center gap-3 bg-card border border-sage-200/60 rounded-2xl p-4 shadow-soft hover:bg-sage-100/40 transition">
          <div className="p-2 rounded-xl bg-sage-100 text-sage-600"><Sparkles className="h-4 w-4" /></div>
          <div className="flex-1 text-start">
            <p className="font-bold text-sm text-sage-600">{lang === "ar" ? "المساعد الذكي" : "AI Assistant"}</p>
            <p className="text-[11px] text-muted-foreground">{lang === "ar" ? "اسأل عن عقاراتك واحصل على رؤى" : "Ask about your properties"}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-sage-500 rtl:rotate-180" />
        </Link>
        <div className="bg-card border border-sage-200/60 rounded-2xl p-4 shadow-soft flex items-center gap-3">
          <div className="p-2 rounded-xl bg-sage-100 text-sage-600"><Sparkles className="h-4 w-4" /></div>
          <div className="flex-1">
            <p className="font-bold text-sm text-sage-600">{lang === "ar" ? "زر المساعد الذكي العائم" : "Floating AI button"}</p>
            <p className="text-[11px] text-muted-foreground">{lang === "ar" ? "إظهار زر سريع للمساعد على الرئيسية" : "Show quick AI button on dashboard"}</p>
          </div>
          <button
            onClick={() => { update({ showAiFab: !settings.showAiFab }); toast.success(L("saved")); }}
            className={`relative w-11 h-6 rounded-full transition-colors ${settings.showAiFab ? "bg-sage-500" : "bg-muted"}`}
            aria-label="toggle ai fab"
          >
            <span className={`absolute top-0.5 ${settings.showAiFab ? "end-0.5" : "start-0.5"} h-5 w-5 rounded-full bg-white shadow-soft transition-all`} />
          </button>
        </div>
      </section>

      {/* Live receipt preview */}
      <section className="px-5 mt-5">
        <div className="flex items-center gap-2 mb-2">
          <Eye className="h-4 w-4 text-sage-500" />
          <h2 className="font-bold text-sage-600 text-sm">{L("live_preview")}</h2>
        </div>
        <div className="flex gap-1.5 mb-3">
          {(["paid", "late", "soon"] as const).map((s) => {
            const c = settings.statusColors[s];
            const active = previewStatus === s;
            return (
              <button
                key={s}
                onClick={() => setPreviewStatus(s)}
                className={`flex-1 px-2 py-1.5 rounded-xl text-xs font-bold transition-all border-2 ${
                  active ? "shadow-soft scale-[1.02]" : "opacity-70"
                }`}
                style={{
                  background: c.bg,
                  color: c.fg,
                  borderColor: active ? c.fg : "transparent",
                }}
              >
                {L(s)}
              </button>
            );
          })}
        </div>
        {(() => {
          const dim = PAGE_SIZES_MM[settings.pageSize];
          const m = settings.margins;
          const top = `${(m.top / dim.h) * 100}%`;
          const right = `${(m.right / dim.w) * 100}%`;
          const bottom = `${(m.bottom / dim.h) * 100}%`;
          const left = `${(m.left / dim.w) * 100}%`;
          return (
            <div className="bg-sage-100/40 rounded-2xl p-4 flex justify-center">
              <div
                className="relative bg-white shadow-soft mx-auto"
                style={{
                  width: "100%",
                  maxWidth: 360,
                  aspectRatio: `${dim.w} / ${dim.h}`,
                  border: "1px solid #c9d4c2",
                }}
              >
                {/* margin guides */}
                <div
                  className="absolute pointer-events-none border border-dashed"
                  style={{ top, right, bottom, left, borderColor: "#a3b89c" }}
                />
                {/* margin label */}
                <div className="absolute top-1 left-1 text-[9px] font-mono text-sage-500/70 bg-white/80 px-1 rounded">
                  {settings.pageSize} · {m.top}/{m.right}/{m.bottom}/{m.left}{L("mm")}
                </div>
                {/* receipt content positioned inside margin */}
                <div className="absolute overflow-hidden" style={{ top, right, bottom, left }}>
                  <div
                    className="relative h-full w-full overflow-hidden rounded-xl border-2 p-3"
                    style={{ borderColor: "#a3b89c", background: "#fff", color: "#3a4f3a" }}
                  >
                    <div
                      className="absolute inset-0 flex items-center justify-center pointer-events-none font-black tracking-[6px]"
                      style={{ fontSize: 44, color: "#a3b89c", opacity: 0.08 }}
                    >
                      {L(previewStatus).toUpperCase()}
                    </div>
                    <div className="relative">
                      <div className="flex justify-between items-start pb-2 mb-2 border-b" style={{ borderColor: "#eef3ea" }}>
                        <div>
                          <h3 className="text-xs font-black" style={{ color: "#5a7359" }}>أملاكي · Amlaki</h3>
                          <p className="text-[7px] uppercase tracking-widest" style={{ color: "#7a8a78" }}>
                            {t2("receipt_number")} · A-2025-001
                          </p>
                        </div>
                        <span
                          className="px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-wider"
                          style={{ background: pc.bg, color: pc.fg }}
                        >
                          {L(previewStatus)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 mb-2">
                        <div className="rounded px-1.5 py-1" style={{ background: "#f6faf3" }}>
                          <p className="text-[6px] uppercase tracking-wider" style={{ color: "#7a8a78" }}>{t2("payment_date")}</p>
                          <p className="text-[9px] font-bold" style={{ color: "#5a7359" }}>{today}</p>
                        </div>
                        <div className="rounded px-1.5 py-1" style={{ background: "#f6faf3" }}>
                          <p className="text-[6px] uppercase tracking-wider" style={{ color: "#7a8a78" }}>{t2("building_name")}</p>
                          <p className="text-[9px] font-bold truncate" style={{ color: "#5a7359" }}>{L("sample_building")}</p>
                        </div>
                      </div>
                      <div className="flex justify-between py-1 text-[9px] border-b border-dashed" style={{ borderColor: "#cdd9c8" }}>
                        <span style={{ color: "#7a8a78" }}>{t2("unit_number")}</span>
                        <span className="px-1.5 py-0 rounded text-[8px] font-black text-white" style={{ background: "#5a7359" }}>#A-12</span>
                      </div>
                      <div className="flex justify-between py-1 text-[9px] border-b border-dashed" style={{ borderColor: "#cdd9c8" }}>
                        <span style={{ color: "#7a8a78" }}>{t2("status")}</span>
                        <span className="font-bold" style={{ color: pc.fg }}>{L(previewStatus)}</span>
                      </div>
                      <div className="flex justify-between py-1 text-[9px] border-b border-dashed" style={{ borderColor: "#cdd9c8" }}>
                        <span style={{ color: "#7a8a78" }}>{t2("tenant_name")}</span>
                        <span className="font-bold truncate ms-2" style={{ color: "#3a4f3a" }}>{L("sample_tenant")}</span>
                      </div>
                      <div
                        className="mt-2 px-2 py-1.5 rounded-lg flex justify-between items-center font-black text-[11px]"
                        style={{ background: "linear-gradient(135deg,#eef3ea,#dcebd2)", color: "#3a6b3a" }}
                      >
                        <span>{t2("total")}</span>
                        <span>{format(120)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </section>

      {/* Print layout */}
      <section className="px-5 mt-6">
        <div className="flex items-center gap-2 mb-2">
          <Printer className="h-4 w-4 text-sage-500" />
          <h2 className="font-bold text-sage-600 text-sm">{L("print_layout")}</h2>
        </div>
        <div className="bg-card border border-sage-200/50 rounded-2xl p-4 shadow-soft space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2">{L("page_size")}</p>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(PAGE_SIZES_MM) as PageSize[]).map((s) => {
                const active = settings.pageSize === s;
                return (
                  <button
                    key={s}
                    onClick={() => { update({ pageSize: s }); toast.success(L("saved")); }}
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
              <p className="text-xs text-muted-foreground">{L("margins")} ({L("mm")})</p>
              <button
                type="button"
                onClick={() => {
                  const v = settings.margins.top;
                  update({ margins: { top: v, right: v, bottom: v, left: v } });
                }}
                className="text-[10px] font-bold text-sage-500 underline"
              >
                {L("link_all")}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(["top", "right", "bottom", "left"] as const).map((side) => (
                <label key={side} className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sage-500 w-12">
                    {L(`margin_${side}`)}
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
      </section>

      {/* Status colors */}
      <section className="px-5 mt-6">
        <div className="flex items-center gap-2 mb-2">
          <Palette className="h-4 w-4 text-sage-500" />
          <h2 className="font-bold text-sage-600 text-sm">{L("status_colors")}</h2>
        </div>
        <div className="space-y-3">
          {(["paid", "late", "soon"] as const).map((k) => {
            const c = settings.statusColors[k];
            return (
              <div key={k} className="bg-card border border-sage-200/50 rounded-2xl p-3 shadow-soft">
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="px-3 py-1 rounded-full font-bold text-xs uppercase tracking-wider"
                    style={{ background: c.bg, color: c.fg }}
                  >
                    {L(k)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{L("preview")}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground w-16">{L("bg_color")}</span>
                    <input
                      type="color"
                      value={c.bg}
                      onChange={(e) => setStatusColor(k, { ...c, bg: e.target.value })}
                      className="h-9 w-12 rounded cursor-pointer border border-sage-200"
                    />
                    <Input value={c.bg} onChange={(e) => setStatusColor(k, { ...c, bg: e.target.value })} className="h-9 text-xs font-mono" />
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground w-16">{L("fg_color")}</span>
                    <input
                      type="color"
                      value={c.fg}
                      onChange={(e) => setStatusColor(k, { ...c, fg: e.target.value })}
                      className="h-9 w-12 rounded cursor-pointer border border-sage-200"
                    />
                    <Input value={c.fg} onChange={(e) => setStatusColor(k, { ...c, fg: e.target.value })} className="h-9 text-xs font-mono" />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Filter retention */}
      <section className="px-5 mt-6">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="h-4 w-4 text-sage-500" />
          <h2 className="font-bold text-sage-600 text-sm">{L("filter_retention")}</h2>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {RETENTIONS.map((r) => {
            const active = settings.filterRetentionMin === r.v;
            return (
              <button
                key={r.v}
                onClick={() => { update({ filterRetentionMin: r.v }); toast.success(L("saved")); }}
                className={`px-2 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  active ? "bg-gradient-sage text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground"
                }`}
              >
                {RL(r.key)}
              </button>
            );
          })}
        </div>
      </section>

      {/* Delete PIN */}
      <section className="px-5 mt-6">
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert className="h-4 w-4 text-burgundy" />
          <h2 className="font-bold text-sage-600 text-sm">
            {lang === "ar" ? "حماية الحذف برقم سري" : "Delete protection PIN"}
          </h2>
        </div>
        <div className="bg-card border border-sage-200/50 rounded-2xl p-4 shadow-soft space-y-2">
          <p className="text-[11px] text-muted-foreground">
            {lang === "ar"
              ? "عند تفعيله، يطلب التطبيق هذا الرقم قبل حذف أي دفعة. يمنع الحذف بالخطأ. اتركه فارغاً للتعطيل."
              : "When set, the app asks for this PIN before deleting any payment. Leave empty to disable."}
          </p>
          <Input
            type="password"
            inputMode="numeric"
            maxLength={12}
            placeholder={lang === "ar" ? "بدون رقم سري" : "No PIN"}
            defaultValue={settings.deletePin || ""}
            onBlur={(e) => {
              const v = e.target.value.trim();
              update({ deletePin: v ? v : null });
              toast.success(L("saved"));
            }}
            className="rounded-xl border-sage-200 bg-card h-11 font-mono text-center tracking-[0.4em]"
          />
          {settings.deletePin && (
            <p className="text-[10px] text-sage-500 text-center">
              {lang === "ar" ? "✓ الحماية مفعّلة" : "✓ Protection enabled"}
            </p>
          )}
        </div>
      </section>

      {/* Notifications timing */}
      <section className="px-5 mt-6">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="h-4 w-4 text-sage-600" />
          <h2 className="font-bold text-sage-600 text-sm">
            {lang === "ar" ? "إعدادات التنبيهات" : "Notification timing"}
          </h2>
        </div>
        <div className="bg-card border border-sage-200/50 rounded-2xl p-4 shadow-soft grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-[11px] text-sage-500 font-semibold">
              {lang === "ar" ? "تنبيه قبل الاستحقاق (يوم)" : "Days before due"}
            </span>
            <Input type="number" min={1} max={30} value={settings.upcomingDays}
              onChange={(e) => update({ upcomingDays: Math.max(1, parseInt(e.target.value) || 7) })}
              className="rounded-xl border-sage-200 bg-card h-10" />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-sage-500 font-semibold">
              {lang === "ar" ? "تنبيه قبل انتهاء العقد (يوم)" : "Days before contract end"}
            </span>
            <Input type="number" min={1} max={180} value={settings.contractWarnDays}
              onChange={(e) => update({ contractWarnDays: Math.max(1, parseInt(e.target.value) || 30) })}
              className="rounded-xl border-sage-200 bg-card h-10" />
          </label>
        </div>
      </section>

      {/* Message templates */}
      <section className="px-5 mt-6">
        <div className="flex items-center gap-2 mb-2">
          <MessageCircle className="h-4 w-4 text-[#128C7E]" />
          <h2 className="font-bold text-sage-600 text-sm">
            {lang === "ar" ? "قوالب رسائل واتساب" : "WhatsApp templates"}
          </h2>
        </div>
        <div className="bg-card border border-sage-200/50 rounded-2xl p-4 shadow-soft space-y-3">
          <p className="text-[10px] text-muted-foreground">
            {lang === "ar"
              ? "متغيرات متاحة: {tenant} {unit} {building} {amount} {date}"
              : "Variables: {tenant} {unit} {building} {amount} {date}"}
          </p>
          {(["reminder", "late", "receipt"] as const).map((k) => (
            <label key={k} className="block space-y-1">
              <span className="text-[11px] text-sage-500 font-semibold">
                {k === "reminder" ? (lang === "ar" ? "تذكير عام" : "Reminder") :
                 k === "late" ? (lang === "ar" ? "متأخر" : "Late") :
                 (lang === "ar" ? "إيصال" : "Receipt")}
              </span>
              <Textarea value={settings.templates[k]}
                onChange={(e) => update({ templates: { ...settings.templates, [k]: e.target.value } })}
                rows={3}
                className="rounded-xl border-sage-200 bg-card text-xs" />
            </label>
          ))}
        </div>
      </section>
      {/* Advanced */}
      <section className="px-5 mt-6 space-y-2">
        <Link to="/team" className="flex items-center gap-3 bg-card border border-sage-200/60 rounded-2xl p-4 shadow-soft hover:bg-sage-50 transition">
          <div className="p-2 rounded-xl bg-sage-100 text-sage-600"><Users className="h-4 w-4" /></div>
          <div className="flex-1 text-start">
            <p className="font-bold text-sm text-sage-600">{lang === "ar" ? "الفريق والصلاحيات" : "Team & roles"}</p>
            <p className="text-[11px] text-muted-foreground">{lang === "ar" ? "ادعُ محاسبين أو مدراء فرع" : "Invite accountants or managers"}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-sage-500 rtl:rotate-180" />
        </Link>
        <Link to="/backup" className="flex items-center gap-3 bg-card border border-sage-200/60 rounded-2xl p-4 shadow-soft hover:bg-sage-50 transition">
          <div className="p-2 rounded-xl bg-sage-100 text-sage-600"><Database className="h-4 w-4" /></div>
          <div className="flex-1 text-start">
            <p className="font-bold text-sm text-sage-600">{lang === "ar" ? "النسخ الاحتياطي" : "Backup & restore"}</p>
            <p className="text-[11px] text-muted-foreground">{lang === "ar" ? "تصدير واستعادة كل بياناتك" : "Export and restore all your data"}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-sage-500 rtl:rotate-180" />
        </Link>
        <Link to="/install" className="flex items-center gap-3 bg-card border border-sage-200/60 rounded-2xl p-4 shadow-soft hover:bg-sage-50 transition">
          <div className="p-2 rounded-xl bg-sage-100 text-sage-600"><Smartphone className="h-4 w-4" /></div>
          <div className="flex-1 text-start">
            <p className="font-bold text-sm text-sage-600">{lang === "ar" ? "تثبيت التطبيق على الجوال" : "Install on phone"}</p>
            <p className="text-[11px] text-muted-foreground">{lang === "ar" ? "افتحه من الشاشة الرئيسية كتطبيق" : "Launch like a native app"}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-sage-500 rtl:rotate-180" />
        </Link>
      </section>

      {/* Business brand */}
      <section className="px-5 mt-6">
        <div className="flex items-center gap-2 mb-2">
          <ImageIcon className="h-4 w-4 text-sage-600" />
          <h2 className="font-bold text-sage-600 text-sm">
            {lang === "ar" ? "هوية الإيصالات والعقود" : "Receipt & contract branding"}
          </h2>
        </div>
        <div className="bg-card border border-sage-200/50 rounded-2xl p-4 shadow-soft space-y-3">
          <p className="text-[10px] text-muted-foreground">
            {lang === "ar"
              ? "تظهر هذه البيانات في رأس كل إيصال وعقد PDF."
              : "Shown in the header of every receipt and lease PDF."}
          </p>
          <label className="block space-y-1">
            <span className="text-[11px] text-sage-500 font-semibold">{lang === "ar" ? "اسم العمل" : "Business name"}</span>
            <Input value={settings.brand.name}
              onChange={(e) => update({ brand: { ...settings.brand, name: e.target.value } })}
              className="rounded-xl border-sage-200 bg-card h-10" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1">
              <span className="text-[11px] text-sage-500 font-semibold">{lang === "ar" ? "هاتف" : "Phone"}</span>
              <Input value={settings.brand.phone}
                onChange={(e) => update({ brand: { ...settings.brand, phone: e.target.value } })}
                className="rounded-xl border-sage-200 bg-card h-10" />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] text-sage-500 font-semibold">{lang === "ar" ? "العنوان" : "Address"}</span>
              <Input value={settings.brand.address}
                onChange={(e) => update({ brand: { ...settings.brand, address: e.target.value } })}
                className="rounded-xl border-sage-200 bg-card h-10" />
            </label>
          </div>
          <div>
            <span className="text-[11px] text-sage-500 font-semibold block mb-1">{lang === "ar" ? "الشعار (PNG/JPG)" : "Logo (PNG/JPG)"}</span>
            <div className="flex items-center gap-3">
              {settings.brand.logo && (
                <img src={settings.brand.logo} alt="logo" className="h-12 w-12 object-contain rounded-lg border border-sage-200 bg-white p-1" />
              )}
              <input type="file" accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0]; if (!f) return;
                  if (f.size > 500_000) { toast.error(lang === "ar" ? "الحد 500 كيلوبايت" : "Max 500KB"); return; }
                  const reader = new FileReader();
                  reader.onload = () => { update({ brand: { ...settings.brand, logo: String(reader.result) } }); toast.success(L("saved")); };
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

      <div className="px-5 mt-8">
        <Button variant="outline" onClick={() => { reset(); toast.success(L("saved")); }}
          className="w-full rounded-xl border-burgundy/30 text-burgundy hover:bg-burgundy/5">
          <RotateCcw className="h-4 w-4 me-2" /> {L("reset_defaults")}
        </Button>
      </div>

      <BottomNav />
    </div>
  );
}
