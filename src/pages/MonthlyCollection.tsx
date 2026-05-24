import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, CheckCircle2, AlertCircle, Phone, Building2, X, MessageCircle, Sparkles, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { useI18n } from "@/lib/i18n";
import { useT2 } from "@/lib/i18n2";
import { useCurrency } from "@/lib/currency";
import { useAuth } from "@/lib/auth";
import { useAppSettings } from "@/lib/appSettings";
import { supabase } from "@/integrations/supabase/client";
import { exportToCSV } from "@/lib/exportCSV";
import { openWhatsApp, fillTemplate, DEFAULT_TEMPLATES } from "@/lib/whatsapp";
import { buildCollectionHTML, downloadHTMLAsPDF, type CollectionPdfData } from "@/lib/pdfDocs";
import { AddPaymentDialog } from "@/components/AddPaymentDialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface UnitRow {
  id: string;
  unit_number: string;
  building_id: string;
  tenant_name: string | null;
  tenant_phone: string | null;
  rent_amount: number;
  rent_type: string;
  contract_start_date: string | null;
}
interface PaymentRow {
  unit_id: string;
  amount: number;
  payment_date: string;
  period_start: string | null;
}
interface BuildingRow { id: string; name: string; }

const AR_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const EN_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthOptions(lang: string) {
  const names = lang === "ar" ? AR_MONTHS : EN_MONTHS;
  const opts: { key: string; label: string; start: Date; end: Date }[] = [];
  const today = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0, 23, 59, 59);
    opts.push({ key: `${y}-${String(m + 1).padStart(2, "0")}`, label: `${names[m]} ${String(y).slice(2)}`, start, end });
  }
  return opts;
}

function computeMonthRows(units: UnitRow[], payments: PaymentRow[], start: Date, end: Date) {
  return units
    .filter((u) => !u.contract_start_date || new Date(u.contract_start_date) <= end)
    .map((u) => {
      const paidPays = payments.filter((p) => {
        if (p.unit_id !== u.id) return false;
        const ref = p.period_start ? new Date(p.period_start) : new Date(p.payment_date);
        return ref >= start && ref <= end;
      });
      const paid = paidPays.reduce((s, p) => s + Number(p.amount || 0), 0);
      const rent = Number(u.rent_amount || 0);
      const lastDate = paidPays.sort((a, b) => (a.payment_date < b.payment_date ? 1 : -1))[0]?.payment_date;
      let status: "paid" | "partial" | "unpaid" = "unpaid";
      if (paid >= rent && rent > 0) status = "paid";
      else if (paid > 0) status = "partial";
      return { unit: u, rent, paid, remaining: Math.max(0, rent - paid), status, lastDate };
    });
}

export default function MonthlyCollection() {
  const { t, lang } = useI18n();
  const t2 = useT2();
  const { format, currency } = useCurrency();
  const { user } = useAuth();
  const { settings } = useAppSettings();
  const months = useMemo(() => monthOptions(lang), [lang]);
  const [selected, setSelected] = useState<string>(months[months.length - 1].key);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);
  const [presetUnit, setPresetUnit] = useState<string | undefined>();
  const [showPaymentsDialog, setShowPaymentsDialog] = useState(false);
  const [buildingFilter, setBuildingFilter] = useState<string>("all");
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderTemplate, setReminderTemplate] = useState<"reminder" | "late">("late");
  const [reminderExcluded, setReminderExcluded] = useState<Set<string>>(new Set());

  const buildingsMap = useMemo(() => Object.fromEntries(buildings.map((b) => [b.id, b.name])), [buildings]);
  const month = months.find((m) => m.key === selected)!;
  const prevMonth = useMemo(() => {
    const idx = months.findIndex((m) => m.key === selected);
    return idx > 0 ? months[idx - 1] : null;
  }, [months, selected]);

  // Filter units by building
  const filteredUnits = useMemo(
    () => buildingFilter === "all" ? units : units.filter((u) => u.building_id === buildingFilter),
    [units, buildingFilter]
  );

  const rows = useMemo(
    () => computeMonthRows(filteredUnits, payments, month.start, month.end),
    [filteredUnits, payments, month]
  );

  const prevRows = useMemo(
    () => prevMonth ? computeMonthRows(filteredUnits, payments, prevMonth.start, prevMonth.end) : [],
    [filteredUnits, payments, prevMonth]
  );

  const totalDue = rows.reduce((s, r) => s + r.rent, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0);
  const remaining = Math.max(0, totalDue - totalPaid);
  const rate = totalDue > 0 ? Math.min(100, Math.round((totalPaid / totalDue) * 100)) : 0;

  const prevTotalDue = prevRows.reduce((s, r) => s + r.rent, 0);
  const prevTotalPaid = prevRows.reduce((s, r) => s + r.paid, 0);
  const prevRate = prevTotalDue > 0 ? Math.round((prevTotalPaid / prevTotalDue) * 100) : 0;
  const rateDelta = rate - prevRate;
  const collectedDelta = prevTotalPaid > 0 ? Math.round(((totalPaid - prevTotalPaid) / prevTotalPaid) * 100) : 0;

  // Overdue months helper
  const overdueMonthsFor = (unitId: string, contractStart: string | null) => {
    const unitPays = payments.filter((p) => p.unit_id === unitId);
    if (unitPays.length === 0) {
      if (!contractStart) return 0;
      const start = new Date(contractStart);
      const diff = (month.end.getFullYear() - start.getFullYear()) * 12 + (month.end.getMonth() - start.getMonth()) + 1;
      return Math.max(0, diff);
    }
    const last = unitPays.map((p) => p.period_start ? new Date(p.period_start) : new Date(p.payment_date)).sort((a, b) => b.getTime() - a.getTime())[0];
    const diff = (month.end.getFullYear() - last.getFullYear()) * 12 + (month.end.getMonth() - last.getMonth());
    return Math.max(0, diff);
  };

  const paidRows = rows.filter((r) => r.status === "paid");
  const lateRowsRaw = rows.filter((r) => r.status !== "paid");
  // Enrich + sort late by overdue months desc
  const lateRows = useMemo(
    () => lateRowsRaw
      .map((r) => ({ ...r, overdueMonths: overdueMonthsFor(r.unit.id, r.unit.contract_start_date) }))
      .sort((a, b) => b.overdueMonths - a.overdueMonths || b.remaining - a.remaining),
    [lateRowsRaw, payments, month]
  );

  // 12-month heatmap
  const heatmap = useMemo(() => {
    return months.map((m) => {
      const rs = computeMonthRows(filteredUnits, payments, m.start, m.end);
      const due = rs.reduce((s, r) => s + r.rent, 0);
      const paid = rs.reduce((s, r) => s + r.paid, 0);
      const r = due > 0 ? Math.min(100, Math.round((paid / due) * 100)) : 0;
      return { key: m.key, label: m.label, rate: r };
    });
  }, [months, filteredUnits, payments]);

  const oldestOverdue = lateRows[0]?.overdueMonths || 0;

  // Smart summary
  const monthName = month.label;
  const smartSummary = lang === "ar"
    ? `حصّلت ${rate}% من إيجارات ${monthName}${remaining > 0 ? ` — بقي ${lateRows.length} مستأجر${lateRows.length === 1 ? "" : "اً"} بإجمالي ${format(remaining)}` : " — اكتمل التحصيل"}${oldestOverdue > 1 ? `، أقدمهم متأخر منذ ${oldestOverdue} ${oldestOverdue === 2 ? "شهرين" : "أشهر"}` : ""}.`
    : `You've collected ${rate}% of ${monthName} rents${remaining > 0 ? ` — ${lateRows.length} tenant${lateRows.length === 1 ? "" : "s"} remaining totalling ${format(remaining)}` : " — fully collected"}${oldestOverdue > 1 ? `, oldest overdue ${oldestOverdue} months` : ""}.`;

  const dialogPayments = useMemo(() => {
    return payments.filter((p) => {
      const ref = p.period_start ? new Date(p.period_start) : new Date(p.payment_date);
      return ref >= month.start && ref <= month.end;
    });
  }, [payments, month]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: bs } = await supabase.from("buildings").select("id, name").eq("user_id", user.id);
      const bIds = (bs || []).map((b) => b.id);
      setBuildings((bs || []) as BuildingRow[]);
      if (!bIds.length) { setUnits([]); setPayments([]); setLoading(false); return; }
      const { data: us } = await supabase
        .from("units")
        .select("id,unit_number,building_id,tenant_name,tenant_phone,rent_amount,rent_type,contract_start_date")
        .in("building_id", bIds)
        .not("tenant_name", "is", null);
      const uList = (us || []) as UnitRow[];
      setUnits(uList);
      const uIds = uList.map((u) => u.id);
      if (uIds.length) {
        const { data: ps } = await supabase
          .from("payments")
          .select("unit_id,amount,payment_date,period_start")
          .in("unit_id", uIds)
          .is("deleted_at", null);
        setPayments((ps || []) as PaymentRow[]);
      }
      setLoading(false);
    })();
  }, [user]);

  const openPaymentsDialog = () => setShowPaymentsDialog(true);

  const exportCSV = () => {
    const all = [
      ...paidRows.map((r) => ({
        status: "paid", tenant: r.unit.tenant_name, unit: r.unit.unit_number,
        building: buildingsMap[r.unit.building_id] || "", rent: r.rent, paid: r.paid, remaining: 0, last_date: r.lastDate || "",
      })),
      ...lateRows.map((r) => ({
        status: r.status, tenant: r.unit.tenant_name, unit: r.unit.unit_number,
        building: buildingsMap[r.unit.building_id] || "", rent: r.rent, paid: r.paid, remaining: r.remaining,
        overdue_months: r.overdueMonths, last_date: r.lastDate || "",
      })),
    ];
    exportToCSV(`collection-${selected}`, all);
  };

  const exportPDF = async () => {
    const data: CollectionPdfData = {
      brand: {
        name: settings.brand.name || "أملاكي · Amlaki",
        logo: settings.brand.logo,
        phone: settings.brand.phone || "",
        address: settings.brand.address || "",
      },
      currency: currency.symbol,
      lang: lang === "ar" ? "ar" : "en",
      monthLabel: month.label,
      generatedAt: new Date().toLocaleDateString(lang === "ar" ? "ar" : "en-GB"),
      totals: {
        expected: totalDue, collected: totalPaid, remaining, rate,
        paidCount: paidRows.length, lateCount: lateRows.length,
      },
      vsLastMonth: prevMonth ? { rateDelta, collectedDelta } : null,
      late: lateRows.map((r) => ({
        tenant: r.unit.tenant_name || "—", building: buildingsMap[r.unit.building_id] || "",
        unit: r.unit.unit_number, rent: r.rent, paid: r.paid, remaining: r.remaining,
        status: r.status, overdueMonths: r.overdueMonths, lastDate: r.lastDate,
      })),
      paid: paidRows.map((r) => ({
        tenant: r.unit.tenant_name || "—", building: buildingsMap[r.unit.building_id] || "",
        unit: r.unit.unit_number, rent: r.rent, paid: r.paid, remaining: 0,
        status: r.status, lastDate: r.lastDate,
      })),
    };
    await downloadHTMLAsPDF(buildCollectionHTML(data), `collection-${selected}.pdf`, { pageSize: settings.pageSize, margins: settings.margins });
  };

  // WhatsApp helpers
  const buildMsg = (r: typeof lateRows[number], tplKey: "reminder" | "late") => {
    const tpl = DEFAULT_TEMPLATES[tplKey];
    return fillTemplate(tpl, {
      tenant: r.unit.tenant_name || "",
      unit: r.unit.unit_number,
      building: buildingsMap[r.unit.building_id] || "",
      amount: format(r.rent),
      remaining: format(r.remaining),
      date: new Date().toLocaleDateString(lang === "ar" ? "ar" : "en-GB"),
    });
  };

  const sendOne = (r: typeof lateRows[number]) => {
    if (!r.unit.tenant_phone) return;
    openWhatsApp(r.unit.tenant_phone, buildMsg(r, "reminder"));
  };

  const sendBulk = () => {
    const targets = lateRows.filter((r) => r.unit.tenant_phone && !reminderExcluded.has(r.unit.id));
    targets.forEach((r, i) => {
      setTimeout(() => openWhatsApp(r.unit.tenant_phone!, buildMsg(r, reminderTemplate)), i * 400);
    });
    setReminderOpen(false);
  };

  const lateWithPhone = lateRows.filter((r) => r.unit.tenant_phone).length;

  return (
    <div className="mobile-shell pb-24">
      <TopBar />
      <div className="px-5 md:px-8 lg:px-12 pt-5 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 animate-float-up">
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="ghost" size="icon" className="rounded-full text-sage-600">
                <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-black text-sage-600 tracking-tight">{t2("monthly_collection")}</h1>
              <p className="text-xs text-muted-foreground">{lang === "ar" ? "مركز التحصيل الذكي" : "Smart collection center"}</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="rounded-xl border-sage-300 text-sage-600 h-9 px-3" onClick={exportCSV}>
              <Download className="h-3.5 w-3.5 me-1" />CSV
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl border-sage-300 text-sage-600 h-9 px-3" onClick={exportPDF}>
              <FileText className="h-3.5 w-3.5 me-1" />PDF
            </Button>
          </div>
        </div>

        {/* Smart summary */}
        <div className="rounded-2xl border border-sage-300/40 bg-sage-100/40 p-4 flex gap-3 items-start animate-float-up">
          <div className="h-9 w-9 rounded-xl bg-sage-300/30 grid place-items-center flex-shrink-0">
            <Sparkles className="h-4.5 w-4.5 text-sage-600" />
          </div>
          <p className="text-sm leading-relaxed text-sage-700 font-medium">{smartSummary}</p>
        </div>

        {/* Month picker */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1 animate-float-up">
          {months.map((m) => (
            <button key={m.key} onClick={() => setSelected(m.key)}
              className={`flex-shrink-0 px-3.5 py-2 rounded-full text-xs font-semibold transition-all ${
                selected === m.key ? "bg-gradient-sage text-primary-foreground shadow-soft" : "bg-card border border-sage-200/60 text-muted-foreground"
              }`}>{m.label}</button>
          ))}
        </div>

        {/* Building filter */}
        {buildings.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1 animate-float-up">
            <button onClick={() => setBuildingFilter("all")}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                buildingFilter === "all" ? "bg-sage-600 text-primary-foreground" : "bg-card border border-sage-200/60 text-muted-foreground"
              }`}>{lang === "ar" ? "كل المباني" : "All buildings"}</button>
            {buildings.map((b) => (
              <button key={b.id} onClick={() => setBuildingFilter(b.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                  buildingFilter === b.id ? "bg-sage-600 text-primary-foreground" : "bg-card border border-sage-200/60 text-muted-foreground"
                }`}>{b.name}</button>
            ))}
          </div>
        )}

        {/* Progress ring + side KPIs */}
        <div className="bg-card border border-sage-200/40 rounded-3xl p-5 shadow-soft animate-float-up">
          <div className="flex items-center gap-5">
            <ProgressRing percent={rate} />
            <div className="flex-1 space-y-2 min-w-0">
              <SideKpi label={t2("expected_total")} value={format(totalDue)} />
              <SideKpi label={t2("collected_total")} value={format(totalPaid)} accent onClick={openPaymentsDialog}
                delta={prevMonth ? collectedDelta : undefined} />
              <SideKpi label={t2("outstanding_balance")} value={format(remaining)} danger={remaining > 0} />
            </div>
          </div>
          {prevMonth && (
            <div className="mt-4 pt-3 border-t border-sage-200/40 flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground font-semibold">{lang === "ar" ? "مقابل الشهر السابق" : "vs previous month"}</span>
              <span className={cn("font-bold inline-flex items-center gap-1",
                rateDelta > 0 ? "text-sage-600" : rateDelta < 0 ? "text-burgundy" : "text-muted-foreground")}>
                {rateDelta > 0 ? "▲" : rateDelta < 0 ? "▼" : "—"} {Math.abs(rateDelta)}% {lang === "ar" ? "نسبة التحصيل" : "collection rate"}
              </span>
            </div>
          )}
        </div>

        {/* 12-month heatmap */}
        <div className="bg-card border border-sage-200/40 rounded-2xl p-4 shadow-soft animate-float-up">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-[11px] font-bold text-sage-600 uppercase tracking-wider">{lang === "ar" ? "آخر ١٢ شهراً" : "Last 12 months"}</h3>
            <span className="text-[10px] text-muted-foreground">{lang === "ar" ? "اضغط لاختيار شهر" : "tap to jump"}</span>
          </div>
          <div className="grid grid-cols-12 gap-1">
            {heatmap.map((h) => {
              const intensity = Math.max(15, Math.min(100, h.rate));
              const isActive = h.key === selected;
              return (
                <button key={h.key} onClick={() => setSelected(h.key)}
                  title={`${h.label} — ${h.rate}%`}
                  className={cn(
                    "aspect-square rounded-md transition-all flex items-end justify-center pb-0.5",
                    isActive ? "ring-2 ring-sage-600 ring-offset-1 ring-offset-card" : "hover:scale-110"
                  )}
                  style={{
                    backgroundColor: h.rate === 0
                      ? "hsl(var(--sage-100))"
                      : `color-mix(in oklab, hsl(var(--sage-600)) ${intensity}%, hsl(var(--sage-100)))`,
                  }}>
                  <span className={cn("text-[8px] font-bold", h.rate > 55 ? "text-primary-foreground" : "text-sage-600")}>
                    {h.label.split(" ")[0].slice(0, 1)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Counts */}
        <div className="grid grid-cols-2 gap-3 animate-float-up">
          <div className="bg-sage-300/15 border border-sage-300/30 rounded-2xl p-3 text-center">
            <CheckCircle2 className="h-5 w-5 text-sage-600 mx-auto mb-1" />
            <p className="text-2xl font-black text-sage-600">{paidRows.length}</p>
            <p className="text-[11px] text-muted-foreground font-semibold">{lang === "ar" ? "مسدِّدون" : t2("paid_tenants")}</p>
          </div>
          <div className="bg-burgundy/10 border border-burgundy/20 rounded-2xl p-3 text-center">
            <AlertCircle className="h-5 w-5 text-burgundy mx-auto mb-1" />
            <p className="text-2xl font-black text-burgundy">{lateRows.length}</p>
            <p className="text-[11px] text-muted-foreground font-semibold">{lang === "ar" ? "متأخرون" : t2("late_tenants")}</p>
          </div>
        </div>

        {/* Bulk reminder bar */}
        {lateWithPhone > 0 && (
          <div className="bg-card border border-sage-300/40 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-soft animate-float-up">
            <div className="min-w-0">
              <p className="text-sm font-bold text-sage-700">{lang === "ar" ? "تذكير جماعي" : "Bulk reminder"}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {lang === "ar" ? `${lateWithPhone} مستأجر${lateWithPhone === 1 ? "" : "اً"} لديهم رقم واتساب` : `${lateWithPhone} tenant${lateWithPhone === 1 ? "" : "s"} with WhatsApp`}
              </p>
            </div>
            <Button size="sm" onClick={() => { setReminderExcluded(new Set()); setReminderOpen(true); }}
              className="rounded-xl bg-gradient-sage text-primary-foreground h-9 px-3.5 text-xs font-bold flex-shrink-0">
              <MessageCircle className="h-3.5 w-3.5 me-1" />
              {lang === "ar" ? `تذكير ${lateWithPhone}` : `Remind ${lateWithPhone}`}
            </Button>
          </div>
        )}

        {/* Late list */}
        {lateRows.length > 0 && (
          <Section title={`${t2("late_tenants")} · ${lateRows.length}`} accent="burgundy">
            {lateRows.map((r) => (
              <RowCard
                key={r.unit.id}
                tenant={r.unit.tenant_name || "—"}
                unit={r.unit.unit_number}
                building={buildingsMap[r.unit.building_id] || ""}
                phone={r.unit.tenant_phone}
                primary={format(r.remaining)}
                primaryLabel={lang === "ar" ? "المتبقي" : "Remaining"}
                secondary={r.status === "partial" ? (lang === "ar" ? `مدفوع جزئياً: ${format(r.paid)}` : `${t2("partial_payment")}: ${format(r.paid)}`) : undefined}
                tone={r.status === "partial" ? "warn" : "danger"}
                overdueMonths={r.overdueMonths}
                lang={lang}
                action={
                  <div className="flex gap-1.5">
                    {r.unit.tenant_phone && (
                      <Button size="sm" variant="outline" onClick={() => sendOne(r)}
                        className="rounded-xl border-sage-300 text-sage-600 h-8 w-8 p-0 flex-shrink-0">
                        <MessageCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button size="sm" onClick={() => { setPresetUnit(r.unit.id); setPayOpen(true); }}
                      className="rounded-xl bg-gradient-sage text-primary-foreground h-8 px-3 text-[11px] font-bold">
                      {t2("quick_collect")}
                    </Button>
                  </div>
                }
              />
            ))}
          </Section>
        )}

        {/* Paid list */}
        {paidRows.length > 0 && (
          <Section title={`${t2("paid_tenants")} · ${paidRows.length}`} accent="sage">
            {paidRows.map((r) => (
              <RowCard
                key={r.unit.id}
                tenant={r.unit.tenant_name || "—"}
                unit={r.unit.unit_number}
                building={buildingsMap[r.unit.building_id] || ""}
                phone={r.unit.tenant_phone}
                primary={format(r.paid)}
                primaryLabel={r.lastDate || t2("paid")}
                tone="sage"
                lang={lang}
              />
            ))}
          </Section>
        )}

        {!loading && rows.length === 0 && (
          <div className="bg-card border border-sage-200/60 rounded-3xl p-8 text-center">
            <Building2 className="h-10 w-10 text-sage-300 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{lang === "ar" ? "لا يوجد مستأجرون لهذا الشهر" : "No tenants for this month"}</p>
          </div>
        )}
      </div>

      <AddPaymentDialog open={payOpen} onOpenChange={setPayOpen} presetUnitId={presetUnit}
        onSaved={async () => {
          if (!user) return;
          const { data: bs } = await supabase.from("buildings").select("id").eq("user_id", user.id);
          const bIds = (bs || []).map((b) => b.id);
          if (!bIds.length) return;
          const { data: us } = await supabase.from("units").select("id").in("building_id", bIds);
          const uIds = (us || []).map((u: any) => u.id);
          if (uIds.length) {
            const { data: ps } = await supabase.from("payments").select("unit_id,amount,payment_date,period_start").in("unit_id", uIds).is("deleted_at", null);
            setPayments((ps || []) as PaymentRow[]);
          }
        }} />

      {/* Payments dialog */}
      <Dialog open={showPaymentsDialog} onOpenChange={setShowPaymentsDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] p-0 gap-0">
          <DialogHeader className="px-5 md:px-8 lg:px-12 pt-5 pb-2">
            <DialogTitle className="text-lg font-bold text-sage-600">{t2("payments")} — {month.label}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="px-5 pb-5 max-h-[60vh]">
            {dialogPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t2("no_payments")}</p>
            ) : (
              <div className="space-y-2">
                {dialogPayments.map((p) => {
                  const unit = units.find((u) => u.id === p.unit_id);
                  const buildingName = unit ? (buildingsMap[unit.building_id] || "") : "";
                  const period = p.period_start
                    ? `${(lang === "ar" ? AR_MONTHS : EN_MONTHS)[new Date(p.period_start).getMonth()]} ${new Date(p.period_start).getFullYear()}`
                    : "";
                  return (
                    <div key={`${p.unit_id}-${p.payment_date}-${p.amount}`} className="bg-card border border-sage-200/40 rounded-xl p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sage-600 truncate">{unit?.tenant_name || "—"}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{buildingName} · #{unit?.unit_number}</p>
                        {period && <p className="text-[10px] text-sage-500 mt-0.5">{t2("rent_month")}: {period}</p>}
                      </div>
                      <div className="text-end flex-shrink-0">
                        <p className="text-sm font-black text-sage-600">{format(Number(p.amount))}</p>
                        <p className="text-[10px] text-muted-foreground">{p.payment_date}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Bulk reminder dialog */}
      <Dialog open={reminderOpen} onOpenChange={setReminderOpen}>
        <DialogContent className="max-w-md p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-2">
            <DialogTitle className="text-lg font-bold text-sage-600">
              {lang === "ar" ? "تذكير جماعي عبر واتساب" : "Bulk WhatsApp reminder"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {lang === "ar" ? "اختر القالب ثم استبعد من لا تريد إرسال له." : "Pick a template, then deselect anyone you don't want to message."}
            </DialogDescription>
          </DialogHeader>
          <div className="px-5 pb-2 flex gap-1.5">
            {(["late", "reminder"] as const).map((k) => (
              <button key={k} onClick={() => setReminderTemplate(k)}
                className={cn("px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all",
                  reminderTemplate === k ? "bg-sage-600 text-primary-foreground" : "bg-sage-100 text-sage-600")}>
                {k === "late" ? (lang === "ar" ? "متأخر" : "Overdue") : (lang === "ar" ? "تذكير ودّي" : "Friendly reminder")}
              </button>
            ))}
          </div>
          <ScrollArea className="px-5 max-h-[40vh]">
            <div className="space-y-1.5 py-2">
              {lateRows.map((r) => {
                const hasPhone = !!r.unit.tenant_phone;
                const checked = hasPhone && !reminderExcluded.has(r.unit.id);
                return (
                  <label key={r.unit.id}
                    className={cn("flex items-center gap-3 p-2.5 rounded-xl border transition-colors",
                      hasPhone ? "border-sage-200/60 hover:bg-sage-100/40 cursor-pointer" : "border-dashed border-sage-200/40 opacity-50")}>
                    <Checkbox checked={checked} disabled={!hasPhone}
                      onCheckedChange={(v) => {
                        setReminderExcluded((prev) => {
                          const next = new Set(prev);
                          if (v) next.delete(r.unit.id); else next.add(r.unit.id);
                          return next;
                        });
                      }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-sage-700 truncate">{r.unit.tenant_name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {buildingsMap[r.unit.building_id]} · #{r.unit.unit_number} · {format(r.remaining)}
                        {!hasPhone && ` · ${lang === "ar" ? "لا يوجد رقم" : "no phone"}`}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </ScrollArea>
          <div className="px-5 py-4 border-t border-sage-200/40 flex gap-2">
            <Button variant="outline" onClick={() => setReminderOpen(false)} className="flex-1 rounded-xl border-sage-300 text-sage-600">
              {t2("cancel")}
            </Button>
            <Button onClick={sendBulk} className="flex-1 rounded-xl bg-gradient-sage text-primary-foreground font-bold">
              <MessageCircle className="h-4 w-4 me-1" />
              {lang === "ar" ? "إرسال" : "Send"} ({lateRows.filter((r) => r.unit.tenant_phone && !reminderExcluded.has(r.unit.id)).length})
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}

function ProgressRing({ percent }: { percent: number }) {
  const size = 124;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--sage-400))" />
            <stop offset="100%" stopColor="hsl(var(--sage-600))" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--sage-100))" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="url(#ringGrad)" strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 600ms cubic-bezier(.4,0,.2,1)" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <p className="text-3xl font-black text-sage-600 leading-none">{percent}<span className="text-base">%</span></p>
          <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider mt-1">collected</p>
        </div>
      </div>
    </div>
  );
}

function SideKpi({ label, value, accent, danger, onClick, delta }: {
  label: string; value: string; accent?: boolean; danger?: boolean; onClick?: () => void; delta?: number;
}) {
  return (
    <div onClick={onClick}
      className={cn("flex items-center justify-between gap-2 py-1", onClick && "cursor-pointer hover:opacity-80")}>
      <span className="text-[11px] text-muted-foreground font-semibold">{label}</span>
      <div className="text-end">
        <span className={cn("text-sm font-black", danger ? "text-burgundy" : accent ? "text-sage-600" : "text-sage-700")}>
          {value}
        </span>
        {typeof delta === "number" && delta !== 0 && isFinite(delta) && (
          <span className={cn("ms-1.5 text-[10px] font-bold", delta > 0 ? "text-sage-600" : "text-burgundy")}>
            {delta > 0 ? "▲" : "▼"}{Math.abs(delta)}%
          </span>
        )}
      </div>
    </div>
  );
}

function Section({ title, accent, children }: { title: string; accent: "sage" | "burgundy"; children: React.ReactNode }) {
  return (
    <div className="space-y-2 animate-float-up">
      <h3 className={`text-sm font-bold ${accent === "burgundy" ? "text-burgundy" : "text-sage-600"}`}>{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function RowCard({ tenant, unit, building, phone, primary, primaryLabel, secondary, tone, action, overdueMonths, lang }: {
  tenant: string; unit: string; building: string; phone: string | null;
  primary: string; primaryLabel: string; secondary?: string;
  tone: "sage" | "danger" | "warn"; action?: React.ReactNode;
  overdueMonths?: number; lang?: string;
}) {
  const valueCls = tone === "danger" ? "text-burgundy" : tone === "warn" ? "text-terracotta" : "text-sage-600";
  const borderCls = tone === "warn" ? "border-terracotta/30 bg-terracotta/5" : "border-sage-200/40";
  return (
    <div className={cn("bg-card border rounded-2xl p-3.5 flex items-center gap-3 shadow-soft", borderCls)}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-bold text-sage-600 truncate">{tenant}</p>
          {tone === "warn" && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-terracotta/15 text-terracotta uppercase tracking-wider">
              {lang === "ar" ? "جزئي" : "Partial"}
            </span>
          )}
          {overdueMonths && overdueMonths > 1 ? (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-burgundy/15 text-burgundy">
              {lang === "ar" ? `متأخر ${overdueMonths} شهر` : `${overdueMonths} mo overdue`}
            </span>
          ) : null}
        </div>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">🏢 {building} · #{unit}</p>
        {phone && <a href={`tel:${phone}`} className="text-[11px] text-sage-500 inline-flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" />{phone}</a>}
        {secondary && <p className="text-[11px] text-terracotta font-semibold mt-0.5">{secondary}</p>}
      </div>
      <div className="text-end flex-shrink-0">
        <p className={`text-sm font-black ${valueCls}`}>{primary}</p>
        <p className="text-[10px] text-muted-foreground">{primaryLabel}</p>
        {action && <div className="mt-1.5">{action}</div>}
      </div>
    </div>
  );
}
