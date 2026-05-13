import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, CheckCircle2, AlertCircle, Phone, Building2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { useI18n } from "@/lib/i18n";
import { useT2 } from "@/lib/i18n2";
import { useCurrency } from "@/lib/currency";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { exportToCSV } from "@/lib/exportCSV";
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

export default function MonthlyCollection() {
  const { t, lang } = useI18n();
  const t2 = useT2();
  const { format } = useCurrency();
  const { user } = useAuth();
  const months = useMemo(() => monthOptions(lang), [lang]);
  const [selected, setSelected] = useState<string>(months[months.length - 1].key);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [buildings, setBuildings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);
  const [presetUnit, setPresetUnit] = useState<string | undefined>();
  const [showPaymentsDialog, setShowPaymentsDialog] = useState(false);
  const month = months.find((m) => m.key === selected)!;

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
      setBuildings(Object.fromEntries((bs || []).map((b: BuildingRow) => [b.id, b.name])));
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

  const month = months.find((m) => m.key === selected)!;

  const openPaymentsDialog = () => {
    const filtered = payments.filter((p) => {
      const ref = p.period_start ? new Date(p.period_start) : new Date(p.payment_date);
      return ref >= month.start && ref <= month.end;
    });
    setDialogPayments(filtered);
    setShowPaymentsDialog(true);
  };

  // For each unit, compute paid amount in this month (period_start in month, or fallback payment_date)
  const rows = useMemo(() => {
    return units
      .filter((u) => {
        if (!u.contract_start_date) return true;
        return new Date(u.contract_start_date) <= month.end;
      })
      .map((u) => {
        const paidPays = payments.filter((p) => {
          if (p.unit_id !== u.id) return false;
          const ref = p.period_start ? new Date(p.period_start) : new Date(p.payment_date);
          return ref >= month.start && ref <= month.end;
        });
        const paid = paidPays.reduce((s, p) => s + Number(p.amount || 0), 0);
        const rent = Number(u.rent_amount || 0);
        const lastDate = paidPays.sort((a, b) => (a.payment_date < b.payment_date ? 1 : -1))[0]?.payment_date;
        let status: "paid" | "partial" | "unpaid" = "unpaid";
        if (paid >= rent && rent > 0) status = "paid";
        else if (paid > 0) status = "partial";
        return { unit: u, rent, paid, remaining: Math.max(0, rent - paid), status, lastDate };
      });
  }, [units, payments, month]);

  const totalDue = rows.reduce((s, r) => s + r.rent, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0);
  const remaining = Math.max(0, totalDue - totalPaid);
  const rate = totalDue > 0 ? Math.min(100, Math.round((totalPaid / totalDue) * 100)) : 0;
  const paidRows = rows.filter((r) => r.status === "paid");
  const lateRows = rows.filter((r) => r.status !== "paid");

  const exportCSV = () => {
    const all = [
      ...paidRows.map((r) => ({
        status: "paid", tenant: r.unit.tenant_name, unit: r.unit.unit_number,
        building: buildings[r.unit.building_id] || "", rent: r.rent, paid: r.paid, remaining: 0, last_date: r.lastDate || "",
      })),
      ...lateRows.map((r) => ({
        status: r.status, tenant: r.unit.tenant_name, unit: r.unit.unit_number,
        building: buildings[r.unit.building_id] || "", rent: r.rent, paid: r.paid, remaining: r.remaining, last_date: r.lastDate || "",
      })),
    ];
    exportToCSV(`collection-${selected}`, all);
  };

  return (
    <div className="mobile-shell pb-24">
      <TopBar />
      <div className="px-5 pt-5 space-y-5">
        <div className="flex items-center justify-between gap-3 animate-float-up">
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="ghost" size="icon" className="rounded-full text-sage-600">
                <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-black text-sage-600 tracking-tight">{t2("monthly_collection")}</h1>
              <p className="text-xs text-muted-foreground">{lang === "ar" ? "تتبع التحصيل الشهري" : "Track monthly rent collection"}</p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="rounded-xl border-sage-300 text-sage-600" onClick={exportCSV}>
            <Download className="h-3.5 w-3.5 me-1" />CSV
          </Button>
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

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3 animate-float-up">
          <Kpi label={t2("expected_total")} value={format(totalDue)} tone="muted" />
          <Kpi label={t2("collected_total")} value={format(totalPaid)} tone="sage" onClick={openPaymentsDialog} clickable />
          <Kpi label={t2("outstanding_balance")} value={format(remaining)} tone={remaining > 0 ? "danger" : "sage"} />
          <Kpi label={t2("collection_rate")} value={`${rate}%`} tone="sage" onClick={openPaymentsDialog} clickable />
        </div>

        <div className="grid grid-cols-2 gap-3 animate-float-up">
          <div className="bg-sage-300/15 border border-sage-300/30 rounded-2xl p-3 text-center">
            <CheckCircle2 className="h-5 w-5 text-sage-600 mx-auto mb-1" />
            <p className="text-2xl font-black text-sage-600">{paidRows.length}</p>
            <p className="text-[11px] text-muted-foreground font-semibold">{t2("paid_tenants")}</p>
          </div>
          <div className="bg-burgundy/10 border border-burgundy/20 rounded-2xl p-3 text-center">
            <AlertCircle className="h-5 w-5 text-burgundy mx-auto mb-1" />
            <p className="text-2xl font-black text-burgundy">{lateRows.length}</p>
            <p className="text-[11px] text-muted-foreground font-semibold">{t2("late_tenants")}</p>
          </div>
        </div>

        {/* Late list */}
        {lateRows.length > 0 && (
          <Section title={`⚠️ ${t2("late_tenants")} (${lateRows.length})`} accent="burgundy">
            {lateRows.map((r) => (
              <RowCard
                key={r.unit.id}
                tenant={r.unit.tenant_name || "—"}
                unit={r.unit.unit_number}
                building={buildings[r.unit.building_id] || ""}
                phone={r.unit.tenant_phone}
                primary={format(r.remaining)}
                primaryLabel={t2("outstanding_balance")}
                secondary={r.status === "partial" ? `${t2("partial_payment")}: ${format(r.paid)}` : undefined}
                tone="danger"
                action={
                  <Button size="sm" onClick={() => { setPresetUnit(r.unit.id); setPayOpen(true); }}
                    className="rounded-xl bg-gradient-sage text-primary-foreground h-8 px-3 text-[11px] font-bold">
                    {t2("quick_collect")}
                  </Button>
                }
              />
            ))}
          </Section>
        )}

        {/* Paid list */}
        {paidRows.length > 0 && (
          <Section title={`✅ ${t2("paid_tenants")} (${paidRows.length})`} accent="sage">
            {paidRows.map((r) => (
              <RowCard
                key={r.unit.id}
                tenant={r.unit.tenant_name || "—"}
                unit={r.unit.unit_number}
                building={buildings[r.unit.building_id] || ""}
                phone={r.unit.tenant_phone}
                primary={format(r.paid)}
                primaryLabel={r.lastDate || t2("paid")}
                tone="sage"
              />
            ))}
          </Section>
        )}

        {/* Payment details list */}
        {dialogPayments.length > 0 && (
          <Section title={`📋 ${t2("payments")} (${dialogPayments.length})`} accent="sage">
            {dialogPayments.map((p) => {
              const unit = units.find((u) => u.id === p.unit_id);
              const buildingName = unit ? (buildings[unit.building_id] || "") : "";
              const period = p.period_start
                ? `${(lang === "ar" ? AR_MONTHS : EN_MONTHS)[new Date(p.period_start).getMonth()]} ${new Date(p.period_start).getFullYear()}`
                : "";
              return (
                <div key={`${p.unit_id}-${p.payment_date}-${p.amount}`} className="bg-card border border-sage-200/40 rounded-xl p-3 flex items-center gap-3 shadow-soft">
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

      <Dialog open={showPaymentsDialog} onOpenChange={setShowPaymentsDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-2">
            <DialogTitle className="text-lg font-bold text-sage-600">
              {t2("payments")} — {month.label}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="px-5 pb-5 max-h-[60vh]">
            {dialogPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t2("no_payments")}</p>
            ) : (
              <div className="space-y-2">
                {dialogPayments.map((p) => {
                  const unit = units.find((u) => u.id === p.unit_id);
                  const buildingName = unit ? (buildings[unit.building_id] || "") : "";
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

      <BottomNav />
    </div>
  );
}

function Kpi({ label, value, tone, onClick, clickable }: { label: string; value: string; tone: "sage" | "muted" | "danger"; onClick?: () => void; clickable?: boolean }) {
  const cls = tone === "sage" ? "text-sage-600" : tone === "danger" ? "text-burgundy" : "text-sage-600";
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card rounded-2xl p-3 shadow-soft border border-sage-200/40",
        clickable && "cursor-pointer hover:shadow-md active:scale-[0.98] transition-all"
      )}
    >
      <p className="text-[11px] text-muted-foreground font-semibold leading-tight">{label}</p>
      <p className={`text-lg font-black mt-1 truncate ${cls}`}>{value}</p>
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

function RowCard({ tenant, unit, building, phone, primary, primaryLabel, secondary, tone, action }: {
  tenant: string; unit: string; building: string; phone: string | null;
  primary: string; primaryLabel: string; secondary?: string;
  tone: "sage" | "danger"; action?: React.ReactNode;
}) {
  const valueCls = tone === "danger" ? "text-burgundy" : "text-sage-600";
  return (
    <div className="bg-card border border-sage-200/40 rounded-2xl p-3.5 flex items-center gap-3 shadow-soft">
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sage-600 truncate">{tenant}</p>
        <p className="text-[11px] text-muted-foreground truncate">🏢 {building} · #{unit}</p>
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
