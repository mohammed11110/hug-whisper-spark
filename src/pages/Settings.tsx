import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Palette, Clock, Coins, RotateCcw, Eye, Printer } from "lucide-react";
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
};

export default function Settings() {
  const { t, lang } = useI18n();
  const t2 = useT2();
  const { currency, setCurrency, format } = useCurrency();
  const { settings, update, setStatusColor, reset } = useAppSettings();
  const L = (k: string) => SETTINGS_LABELS[k]?.[lang === "ar" ? "ar" : "en"] || SETTINGS_LABELS[k]?.en || k;
  const RL = (k: string) => RET_LABELS[k]?.[lang === "ar" ? "ar" : "en"] || RET_LABELS[k]?.en || k;
  const [openCurr, setOpenCurr] = useState(false);
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
          const marginPct = (settings.marginMm / dim.w) * 100;
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
                  style={{
                    inset: `${marginPct}%`,
                    borderColor: "#a3b89c",
                  }}
                />
                {/* margin label */}
                <div
                  className="absolute top-1 left-1 text-[9px] font-mono text-sage-500/70 bg-white/80 px-1 rounded"
                >
                  {settings.pageSize} · {settings.marginMm}{L("mm")}
                </div>
                {/* receipt content positioned inside margin */}
                <div
                  className="absolute overflow-hidden"
                  style={{ inset: `${marginPct}%` }}
                >
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
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground">{L("margins")}</p>
              <span className="text-xs font-mono font-bold text-sage-600">{settings.marginMm} {L("mm")}</span>
            </div>
            <input
              type="range"
              min={5}
              max={40}
              step={1}
              value={settings.marginMm}
              onChange={(e) => update({ marginMm: Number(e.target.value) })}
              className="w-full accent-sage-500"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>5</span><span>20</span><span>40</span>
            </div>
          </div>
        </div>
      </section>

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
