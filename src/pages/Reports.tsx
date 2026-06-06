import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { useI18n } from "@/lib/i18n";
import { useT2 } from "@/lib/i18n2";
import { useCurrency } from "@/lib/currency";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, AlertCircle, TrendingUp, CheckCircle2, Home, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToCSV } from "@/lib/exportCSV";
import { buildReportHTML, downloadHTMLAsPDF, downloadReportPDFDirect, type ReportData } from "@/lib/pdfDocs";
import { useAppSettings } from "@/lib/appSettings";
import { getUnitArrears } from "@/lib/balance";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";

type Range = 6 | 12 | 24;

interface Building {
  id: string;
  name: string;
}
interface Unit {
  id: string;
  building_id: string;
  status: string;
  rent_amount: number;
  rent_type?: string;
  rent_timing?: string | null;
  contract_start_date?: string | null;
  opening_balance?: number | null;
  opening_balance_date?: string | null;
}
interface Payment {
  id: string;
  unit_id: string;
  amount: number;
  payment_date: string;
  period_start?: string | null;
  period_end?: string | null;
  deleted_at?: string | null;
}
interface Expense {
  id: string;
  building_id: string;
  amount: number;
  expense_date: string;
  category: string;
}

export default function Reports() {
  const { t, lang } = useI18n();
  const t2 = useT2();
  const { format, currency } = useCurrency();
  const { user } = useAuth();
  const { settings } = useAppSettings();
  const [range, setRange] = useState<Range>(6);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentsTick, setPaymentsTick] = useState(0);
  useEffect(() => {
    let unsub: (() => void) | null = null;
    import("@/lib/paymentsBus").then(({ paymentsBus }) => {
      unsub = paymentsBus.subscribe(() => setPaymentsTick((t) => t + 1));
    });
    return () => { if (unsub) unsub(); };
  }, []);


  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: bs } = await supabase
        .from("buildings")
        .select("id, name")
        .eq("user_id", user.id);
      const ids = (bs || []).map((b) => b.id);
      let us: Unit[] = [];
      let ps: Payment[] = [];
      let ex: Expense[] = [];
      if (ids.length) {
        const { data: usData } = await supabase
          .from("units")
          .select("id, building_id, status, rent_amount, rent_type, rent_timing, contract_start_date, opening_balance, opening_balance_date")
          .in("building_id", ids);
        us = (usData as Unit[]) || [];
        const unitIds = us.map((u) => u.id);
        if (unitIds.length) {
          const { data: psData } = await supabase
            .from("payments")
            .select("id, unit_id, amount, payment_date, period_start, period_end, deleted_at")
            .in("unit_id", unitIds)
            .is("deleted_at", null);
          ps = (psData as Payment[]) || [];
        }
        const { data: exData } = await supabase
          .from("expenses")
          .select("id, building_id, amount, expense_date, category")
          .in("building_id", ids);
        ex = (exData as Expense[]) || [];
      }
      setBuildings(bs || []);
      setUnits(us);
      setPayments(ps);
      setExpenses(ex);
      setLoading(false);
    })();
  }, [user, paymentsTick]);

  const now = new Date();
  const months = useMemo(() => {
    const out: { key: string; label: string; income: number; expenses: number; net: number; prev: number }[] = [];
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString(lang === "ar" ? "ar" : "en", { month: "short" });
      out.push({ key, label, income: 0, expenses: 0, net: 0, prev: 0 });
    }
    payments.forEach((p) => {
      const ref = p.period_start || p.payment_date;
      const k = ref.slice(0, 7);
      const m = out.find((x) => x.key === k);
      if (m) m.income += Number(p.amount) || 0;
      // previous-year comparison
      const d = new Date(ref);
      const prevKey = `${d.getFullYear() + 1}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const pm = out.find((x) => x.key === prevKey);
      if (pm) pm.prev += Number(p.amount) || 0;
    });
    expenses.forEach((e) => {
      const k = e.expense_date.slice(0, 7);
      const m = out.find((x) => x.key === k);
      if (m) m.expenses += Number(e.amount) || 0;
    });
    out.forEach((m) => { m.net = m.income - m.expenses; });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments, expenses, range, lang]);

  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const totalExpenses = months.reduce((s, m) => s + m.expenses, 0);
  const totalNet = totalIncome - totalExpenses;
  const avgIncome = months.length ? totalIncome / months.length : 0;
  const lastMonth = months[months.length - 1]?.income || 0;
  const prevMonth = months[months.length - 2]?.income || 0;
  const growth = prevMonth > 0 ? ((lastMonth - prevMonth) / prevMonth) * 100 : 0;

  const totalUnits = units.length;
  const rented = units.filter((u) => u.status === "rented" || u.status === "paid").length;
  const vacant = units.filter((u) => u.status === "vacant").length;
  // عدد الوحدات المتأخرة = أي وحدة لديها متأخرات > 0 (مصدر الحقيقة: getUnitArrears).
  const late = units.filter((u) => {
    if (!u.rent_amount) return false;
    const arr = getUnitArrears(u as any, payments as any, new Date(), lang as "ar" | "en");
    return arr.totalShortfall > 0.009;
  }).length;
  const totalArrears = units.reduce((s, u) => {
    if (!u.rent_amount) return s;
    const arr = getUnitArrears(u as any, payments as any, new Date(), lang as "ar" | "en");
    return s + arr.totalShortfall;
  }, 0);
  const occupancy = totalUnits ? Math.round((rented / totalUnits) * 100) : 0;
  const expectedMonthly = units
    .filter((u) => u.status !== "vacant")
    .reduce((s, u) => s + (Number(u.rent_amount) || 0), 0);
  const collectionRate = expectedMonthly > 0 ? Math.min(100, Math.round((lastMonth / expectedMonthly) * 100)) : 0;

  const statusData = [
    { name: t2("rented"), value: rented, color: "hsl(var(--primary))" },
    { name: t2("vacant"), value: vacant, color: "hsl(var(--muted-foreground))" },
    { name: t2("late"), value: late, color: "hsl(var(--destructive))" },
  ].filter((x) => x.value > 0);

  const topBuildings = useMemo(() => {
    const map = new Map<string, number>();
    const unitToB = new Map(units.map((u) => [u.id, u.building_id]));
    payments.forEach((p) => {
      const bId = unitToB.get(p.unit_id);
      if (!bId) return;
      map.set(bId, (map.get(bId) || 0) + (Number(p.amount) || 0));
    });
    return buildings
      .map((b) => ({ name: b.name, income: map.get(b.id) || 0 }))
      .sort((a, b) => b.income - a.income)
      .slice(0, 5);
  }, [buildings, units, payments]);

  const buildingBreakdown = useMemo(() => {
    const unitToB = new Map(units.map((u) => [u.id, u.building_id]));
    return buildings.map((b) => {
      const bUnits = units.filter((u) => u.building_id === b.id);
      const rentedB = bUnits.filter((u) => u.status !== "vacant").length;
      const vacantB = bUnits.filter((u) => u.status === "vacant").length;
      const expectedMonthlyB = bUnits.filter((u) => u.status !== "vacant")
        .reduce((s, u) => s + (Number(u.rent_amount) || 0), 0);
      const incomeB = payments
        .filter((p) => unitToB.get(p.unit_id) === b.id)
        .reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const expensesB = expenses
        .filter((e) => e.building_id === b.id)
        .reduce((s, e) => s + (Number(e.amount) || 0), 0);
      return { name: b.name, units: bUnits.length, rented: rentedB, vacant: vacantB, expectedMonthly: expectedMonthlyB, income: incomeB, expenses: expensesB };
    });
  }, [buildings, units, payments, expenses]);

  const handleDownloadPDF = async () => {
    const data: ReportData = {
      brand: {
        name: settings.brand.name || "أملاكي · Amlaki",
        logo: settings.brand.logo,
        phone: settings.brand.phone || "",
        address: settings.brand.address || "",
      },
      currency: String(currency),
      rangeMonths: range,
      generatedAt: new Date().toLocaleDateString(lang === "ar" ? "ar" : "en-GB"),
      totals: {
        income: totalIncome,
        expenses: totalExpenses,
        net: totalNet,
        buildings: buildings.length,
        units: totalUnits,
        rented,
        vacant,
        late,
        occupancy,
        collectionRate,
      },
      monthly: months.map((m) => ({ label: m.label, income: m.income, expenses: m.expenses, net: m.net })),
      buildings: buildingBreakdown,
    };
    await downloadReportPDFDirect(
      data,
      `amlaki-report-${new Date().toISOString().slice(0, 10)}.pdf`
    );
  };

  return (
    <div className="mobile-shell pb-24 md:pb-8">
      <TopBar />
      <div className="px-5 md:px-8 lg:px-12 pt-5 space-y-5">
        <div className="animate-float-up flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-sage-600 tracking-tight">{t("reports")}</h1>
            <p className="text-sm text-muted-foreground">{lang === "ar" ? "نظرة شاملة على الأداء" : "Performance overview"}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="rounded-xl border-sage-300 text-sage-600"
              onClick={() => exportToCSV(`reports-${new Date().toISOString().slice(0,10)}`,
                months.map((m) => ({ month: m.label, income: m.income, expenses: m.expenses, net: m.net, prev_year: m.prev })))}>
              <Download className="h-3.5 w-3.5 me-1" />CSV
            </Button>
            <Button size="sm" className="rounded-xl bg-gradient-sage text-primary-foreground" onClick={handleDownloadPDF}>
              <FileText className="h-3.5 w-3.5 me-1" />PDF
            </Button>
          </div>
        </div>

        {/* Monthly collection quick link removed — totals live on the Dashboard. */}

        {/* Range selector */}
        <div className="flex gap-2 animate-float-up" style={{ animationDelay: "0.05s" }}>
          {([6, 12, 24] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                range === r
                  ? "bg-gradient-sage text-primary-foreground shadow-soft"
                  : "bg-card border border-sage-200/60 text-muted-foreground"
              }`}
            >
              {r} {lang === "ar" ? "شهر" : "mo"}
            </button>
          ))}
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-3 animate-float-up" style={{ animationDelay: "0.1s" }}>
          <Kpi
            icon={<TrendingUp className="h-4 w-4" />}
            label={lang === "ar" ? "إجمالي التحصيل" : "Total income"}
            value={format(totalIncome)}
            tone="sage"
          />
          <Kpi
            icon={<TrendingUp className="h-4 w-4" />}
            label={lang === "ar" ? "متوسط شهري" : "Monthly avg"}
            value={format(avgIncome)}
            tone="sage"
          />
          <Kpi
            icon={<TrendingUp className="h-4 w-4" />}
            label={lang === "ar" ? "إجمالي المصروفات" : "Total expenses"}
            value={format(totalExpenses)}
            tone="danger"
          />
          <Kpi
            icon={<CheckCircle2 className="h-4 w-4" />}
            label={lang === "ar" ? "صافي الربح" : "Net profit"}
            value={format(totalNet)}
            tone={totalNet >= 0 ? "sage" : "danger"}
          />
          <Kpi
            icon={<CheckCircle2 className="h-4 w-4" />}
            label={lang === "ar" ? "نسبة التحصيل" : "Collection rate"}
            value={`${collectionRate}%`}
            tone="sage"
          />
          <Kpi
            icon={<Home className="h-4 w-4" />}
            label={lang === "ar" ? "نسبة الإشغال" : "Occupancy"}
            value={`${occupancy}%`}
            tone="sage"
          />
          <Kpi
            icon={<Building2 className="h-4 w-4" />}
            label={t("buildings")}
            value={String(buildings.length)}
            tone="muted"
          />
          <Kpi
            icon={<Users className="h-4 w-4" />}
            label={t("units")}
            value={String(totalUnits)}
            tone="muted"
          />
          <Kpi
            icon={<AlertCircle className="h-4 w-4" />}
            label={lang === "ar" ? "وحدات متأخرة" : "Late units"}
            value={String(late)}
            tone="danger"
          />
          <Kpi
            icon={<AlertCircle className="h-4 w-4" />}
            label={lang === "ar" ? "إجمالي المتأخرات" : "Total arrears"}
            value={format(totalArrears)}
            tone="danger"
          />
          <Kpi
            icon={<TrendingUp className="h-4 w-4" />}
            label={lang === "ar" ? "نمو شهري" : "MoM growth"}
            value={`${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%`}
            tone={growth >= 0 ? "sage" : "danger"}
          />
        </div>

        {/* Income trend */}
        <Card title={lang === "ar" ? "اتجاه التحصيل" : "Income trend"}>
          <div className="h-56 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={months} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} width={40} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => format(v)}
                />
                <Area type="monotone" dataKey="income" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#g1)" />
                <Area type="monotone" dataKey="prev" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="4 3" fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 text-center">
            {lang === "ar" ? "خط متصل: السنة الحالية · متقطع: السنة السابقة" : "Solid: current year · Dashed: previous year"}
          </p>
        </Card>

        {/* Income vs expenses */}
        {(totalExpenses > 0 || totalIncome > 0) && (
          <Card title={lang === "ar" ? "الدخل مقابل المصروفات" : "Income vs expenses"}>
            <div className="h-56 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={months} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} width={40} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => format(v)}
                  />
                  <Bar dataKey="income" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expenses" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Status pie */}
        {statusData.length > 0 && (
          <Card title={lang === "ar" ? "حالة الوحدات" : "Unit status"}>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                    {statusData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-2 flex-wrap">
              {statusData.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                  <span className="text-muted-foreground">{d.name}</span>
                  <span className="font-bold text-sage-600">{d.value}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Top buildings */}
        {topBuildings.length > 0 && topBuildings.some((b) => b.income > 0) && (
          <Card title={lang === "ar" ? "أعلى المباني تحصيلاً" : "Top buildings"}>
            <div className="h-56 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topBuildings} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={11} width={80} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => format(v)}
                  />
                  <Bar dataKey="income" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {!loading && buildings.length === 0 && (
          <div className="bg-card border border-sage-200/60 rounded-3xl p-8 text-center">
            <p className="text-muted-foreground text-sm">
              {lang === "ar" ? "أضف مبانٍ ووحدات لرؤية التقارير" : "Add buildings and units to see reports"}
            </p>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl p-4 shadow-soft border border-sage-200/40 animate-float-up">
      <h3 className="text-sm font-bold text-sage-600 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "sage" | "muted" | "danger";
}) {
  const toneCls =
    tone === "sage"
      ? "bg-sage-100 text-sage-500"
      : tone === "danger"
      ? "bg-burgundy/10 text-burgundy"
      : "bg-muted text-muted-foreground";
  return (
    <div className="bg-card rounded-2xl p-3 shadow-soft border border-sage-200/40">
      <div className={`inline-flex p-1.5 rounded-lg mb-1.5 ${toneCls}`}>{icon}</div>
      <p className="text-[11px] text-muted-foreground font-medium leading-tight">{label}</p>
      <p className="text-base font-black text-sage-600 mt-0.5 truncate">{value}</p>
    </div>
  );
}
