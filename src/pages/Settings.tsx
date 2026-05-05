import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Palette, Clock, Coins, RotateCcw } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { useT2 } from "@/lib/i18n2";
import { useCurrency, CURRENCIES } from "@/lib/currency";
import { useAppSettings } from "@/lib/appSettings";
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
};

export default function Settings() {
  const { t, lang } = useI18n();
  const t2 = useT2();
  const { currency, setCurrency } = useCurrency();
  const { settings, update, setStatusColor, reset } = useAppSettings();
  const L = (k: string) => SETTINGS_LABELS[k]?.[lang === "ar" ? "ar" : "en"] || SETTINGS_LABELS[k]?.en || k;
  const RL = (k: string) => RET_LABELS[k]?.[lang === "ar" ? "ar" : "en"] || RET_LABELS[k]?.en || k;
  const [openCurr, setOpenCurr] = useState(false);

  return (
    <div className="mobile-shell min-h-screen pb-24 bg-background">
      <TopBar />

      <div className="px-5 pt-2 flex items-center gap-2">
        <Link to="/" className="text-sage-500"><ArrowRight className="h-5 w-5 rtl:rotate-180" /></Link>
        <h1 className="text-2xl font-black text-sage-600">{L("page_title")}</h1>
      </div>

      {/* Currency */}
      <section className="px-5 mt-5">
        <div className="flex items-center gap-2 mb-2">
          <Coins className="h-4 w-4 text-sage-500" />
          <h2 className="font-bold text-sage-600 text-sm">{L("currency_section")}</h2>
        </div>
        <button
          onClick={() => setOpenCurr((v) => !v)}
          className="w-full bg-card border border-sage-200/60 rounded-2xl p-4 flex items-center justify-between shadow-soft"
        >
          <span className="font-mono font-bold text-sage-600">{currency.code}</span>
          <span className="text-sm text-muted-foreground flex-1 text-start ms-3">{currency.name}</span>
          <span className="font-bold text-sage-500">{currency.symbol}</span>
        </button>
        {openCurr && (
          <div className="mt-2 max-h-72 overflow-y-auto rounded-2xl border border-sage-200/40 bg-card divide-y divide-sage-100">
            {CURRENCIES.map((c) => (
              <button
                key={c.code}
                onClick={() => { setCurrency(c.code); setOpenCurr(false); toast.success(L("saved")); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm ${
                  c.code === currency.code ? "bg-sage-100/70" : "hover:bg-muted"
                }`}
              >
                <span className="font-mono font-bold w-12 text-start">{c.code}</span>
                <span className="flex-1 text-start opacity-80">{c.name}</span>
                <span className="font-semibold">{c.symbol}</span>
              </button>
            ))}
          </div>
        )}
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
