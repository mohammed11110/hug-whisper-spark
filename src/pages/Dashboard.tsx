import { useEffect, useMemo, useState } from "react";
import {
  Plus, Building2, Users, TrendingUp, Sparkles, ChevronLeft, ChevronRight,
  AlertTriangle, CheckCircle2, Home, Wallet, UserPlus, BarChart3,
} from "lucide-react";

import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { useAuth } from "@/lib/auth";
import { useAppSettings } from "@/lib/appSettings";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";
import { useCountUp } from "@/hooks/useCountUp";
import { useSubscription } from "@/hooks/useSubscription";
import { getUnitArrears, type PaymentForBalance } from "@/lib/balance";


interface Stats {
  buildings: number;
  units: number;
  rented: number;
  vacant: number;
  tenants: number;
  collected: number;
  expected: number;
  paidUnits: number;
  occupiedUnits: number;
}

interface ArrearsSummary {
  count: number;
  total: number;
  oldest: { name: string; unit: string; building: string; days: number; unit_id: string } | null;
}

export default function Dashboard() {
  const { t, lang } = useI18n();
  const { format } = useCurrency();
  const { user } = useAuth();
  const { settings } = useAppSettings();
  const [stats, setStats] = useState<Stats>({
    buildings: 0, units: 0, rented: 0, vacant: 0, tenants: 0,
    collected: 0, expected: 0, paidUnits: 0, occupiedUnits: 0,
  });
  const [profileName, setProfileName] = useState("");
  const [monthOffset, setMonthOffset] = useState(0);
  const [allPayments, setAllPayments] = useState<any[]>([]);
  const [expectedBase, setExpectedBase] = useState(0);
  const [occupiedCount, setOccupiedCount] = useState(0);
  const [arrears, setArrears] = useState<ArrearsSummary>({ count: 0, total: 0, oldest: null });
  const [avgDueDay, setAvgDueDay] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).maybeSingle();
      setProfileName(profile?.name || user.email?.split("@")[0] || "");

      const { data: bRows } = await supabase.from("buildings").select("id, name, name_en").eq("user_id", user.id);
      const bIds = (bRows || []).map((b: any) => b.id);
      const bMap = new Map((bRows || []).map((b: any) => [b.id, b.name || b.name_en || "—"]));
      const buildings = bIds.length;

      if (!bIds.length) {
        setStats({ buildings: 0, units: 0, rented: 0, vacant: 0, tenants: 0, collected: 0, expected: 0, paidUnits: 0, occupiedUnits: 0 });
        setAllPayments([]);
        setArrears({ count: 0, total: 0, oldest: null });
        return;
      }

      const { data: uRows } = await supabase.from("units")
        .select("id, unit_number, status, rent_amount, rent_type, rent_timing, building_id, tenant_name, contract_start_date, opening_balance, opening_balance_date, paid_up_to, due_day, grace_days")
        .in("building_id", bIds);
      const units = uRows?.length ?? 0;
      const occupied = (uRows || []).filter((u: any) => !!u.tenant_name);
      const tenants = occupied.length;
      const expected = occupied.reduce((s: number, u: any) => s + Number(u.rent_amount || 0), 0);
      setExpectedBase(expected);
      setOccupiedCount(occupied.length);

      // Average due day across units that have one set (for context line)
      const dueDays = (uRows || []).map((u: any) => Number(u.due_day)).filter((n) => n >= 1 && n <= 28);
      setAvgDueDay(dueDays.length ? Math.round(dueDays.reduce((s, n) => s + n, 0) / dueDays.length) : null);

      const unitIds = (uRows || []).map((u: any) => u.id);
      let pays: any[] = [];
      if (unitIds.length) {
        const { data } = await supabase.from("payments")
          .select("amount, unit_id, payment_date, period_start, period_end, tenancy_id, kind")
          .in("unit_id", unitIds).is("deleted_at", null);
        pays = data || [];
      }
      setAllPayments(pays);

      // Active tenancy per unit (for arrears scoping)
      const { data: activeTs } = unitIds.length
        ? await supabase.from("tenancies").select("id, unit_id").in("unit_id", unitIds).eq("status", "active")
        : { data: [] as any[] };
      const activeMap = new Map<string, string>((activeTs || []).map((t: any) => [t.unit_id, t.id]));

      // Arrears summary
      const today = new Date();
      let count = 0;
      let total = 0;
      let oldest: ArrearsSummary["oldest"] = null;
      let oldestDate: string | null = null;
      for (const u of (uRows || []) as any[]) {
        if (!u.tenant_name) continue;
        const arr = getUnitArrears(u, pays as PaymentForBalance[], today, lang as "ar" | "en", activeMap.get(u.id) || null);
        if (arr.totalShortfall > 0.009) {
          count += 1;
          total += arr.totalShortfall;
          const dueIso = arr.oldestUnpaid?.periodEndIso || arr.oldestUnpaid?.periodStartIso || null;
          if (dueIso && (!oldestDate || dueIso < oldestDate)) {
            oldestDate = dueIso;
            const days = Math.max(0, Math.floor((today.getTime() - new Date(dueIso).getTime()) / 86400000));
            oldest = {
              name: u.tenant_name,
              unit: u.unit_number,
              building: (bMap.get(u.building_id) as string) || "—",
              days,
              unit_id: u.id,
            };
          }
        }
      }
      setArrears({ count, total, oldest });

      setStats((s) => ({
        ...s,
        buildings,
        units,
        rented: occupied.length,
        vacant: units - occupied.length,
        tenants,
        expected,
        occupiedUnits: occupied.length,
      }));
    })();
  }, [user, lang]);

  const { monthKey, monthLabel } = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString(lang === "ar" ? "ar" : "en", { month: "long", year: "numeric" });
    return { monthKey: key, monthLabel: label };
  }, [monthOffset, lang]);

  useEffect(() => {
    const inMonth = allPayments.filter((p: any) => ((p.period_start || p.payment_date) || "").slice(0, 7) === monthKey);
    const collected = inMonth.reduce((s: number, p: any) => s + Number(p.amount), 0);
    const paidUnits = new Set(inMonth.map((p: any) => p.unit_id)).size;
    setStats((s) => ({ ...s, collected, paidUnits, expected: expectedBase, occupiedUnits: occupiedCount }));
  }, [allPayments, monthKey, expectedBase, occupiedCount]);


  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return t("good_morning");
    if (h < 18) return t("good_afternoon");
    return t("good_evening");
  })();

  const isEmpty = stats.buildings === 0;
  const collectionPct = stats.expected > 0 ? Math.min(100, Math.round((stats.collected / stats.expected) * 100)) : 0;
  const animatedCollected = useCountUp(stats.collected, 600);

  // Context line under collection bar
  const collectionContext = useMemo(() => {
    if (stats.expected <= 0) return "";
    const due = avgDueDay ?? 1;
    const todayDay = new Date().getDate();
    const viewingCurrent = monthOffset === 0;
    if (viewingCurrent && todayDay < due) {
      return lang === "ar"
        ? `طبيعي في بداية الشهر — موعد الاستحقاق يوم ${due}`
        : `Normal early in the month — due on the ${due}${suffix(due)}`;
    }
    if (viewingCurrent && todayDay <= due + 5) {
      return lang === "ar"
        ? `قريب من موعد الاستحقاق (يوم ${due})`
        : `Around the due date (the ${due}${suffix(due)})`;
    }
    if (collectionPct >= 95) {
      return lang === "ar" ? "تحصيل ممتاز لهذا الشهر" : "Excellent collection this month";
    }
    if (collectionPct >= 70) {
      return lang === "ar" ? "تحصيل جيد — يستمر" : "Healthy collection — keep going";
    }
    return lang === "ar"
      ? `متبقي ${format(Math.max(0, stats.expected - stats.collected))} للتحصيل`
      : `${format(Math.max(0, stats.expected - stats.collected))} still to collect`;
  }, [avgDueDay, monthOffset, collectionPct, lang, stats.expected, stats.collected, format]);


  return (
    <div className="mobile-shell pb-24 md:pb-8">
      <TopBar />

      <div className="px-5 md:px-8 lg:px-12 pt-5 space-y-5 md:space-y-6">
        <div className="animate-float-up">
          <p className="text-sm text-muted-foreground">{greeting}</p>
          <h1 className="text-2xl font-black text-sage-600 tracking-tight">{profileName} 👋</h1>
        </div>

        {/* Hero card — income */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-sage p-5 text-primary-foreground shadow-glow animate-float-up" style={{ animationDelay: "0.05s" }}>
          <div className="relative z-10">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-wider opacity-80">
                {monthOffset === 0
                  ? t("collected_this_month")
                  : (lang === "ar" ? `المحصل في ${monthLabel}` : `Collected in ${monthLabel}`)}
              </p>
              <div className="flex items-center gap-1 bg-card/15 backdrop-blur rounded-full p-0.5">
                <button
                  type="button"
                  aria-label={lang === "ar" ? "الشهر السابق" : "Previous month"}
                  onClick={() => setMonthOffset((o) => Math.max(-3, o - 1))}
                  disabled={monthOffset <= -3}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-full text-primary-foreground hover:bg-card/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-4 w-4 rtl:hidden" />
                  <ChevronLeft className="h-4 w-4 hidden rtl:inline" />
                </button>
                <span className="text-[11px] font-bold tabular-nums min-w-[70px] text-center">{monthLabel}</span>
                <button
                  type="button"
                  aria-label={lang === "ar" ? "الشهر التالي" : "Next month"}
                  onClick={() => setMonthOffset((o) => Math.min(0, o + 1))}
                  disabled={monthOffset >= 0}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-full text-primary-foreground hover:bg-card/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4 rtl:hidden" />
                  <ChevronRight className="h-4 w-4 hidden rtl:inline" />
                </button>
              </div>
            </div>
            <p className="text-4xl font-black mt-2 tabular-nums">{format(animatedCollected)}</p>
            <div className="mt-3 inline-flex items-center gap-1 bg-card/15 backdrop-blur rounded-full px-2.5 py-1 text-xs">
              <TrendingUp className="h-3 w-3" /> +0%
            </div>
          </div>
        </div>

        {/* Arrears alert strip */}
        {!isEmpty && (arrears.count > 0 ? (
          <Link
            to="/tenants?filter=overdue"
            className="block rounded-2xl border border-burgundy/30 bg-burgundy/10 p-4 shadow-soft animate-float-up hover:bg-burgundy/15 transition-colors"
            style={{ animationDelay: "0.08s" }}
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-burgundy/20 grid place-items-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-burgundy" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-black uppercase tracking-wider text-burgundy">
                    {lang === "ar" ? "تنبيه متأخرات" : "Arrears alert"}
                  </p>
                  <span className="text-burgundy rtl:rotate-180 text-lg leading-none">›</span>
                </div>
                <p className="text-sm font-bold text-sage-600 mt-1">
                  {lang === "ar"
                    ? `${arrears.count} مستأجر متأخر · ${format(arrears.total)}`
                    : `${arrears.count} overdue tenant${arrears.count > 1 ? "s" : ""} · ${format(arrears.total)}`}
                </p>
                {arrears.oldest && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {lang === "ar"
                      ? `الأقدم: ${arrears.oldest.name} — ${arrears.oldest.building} / ${arrears.oldest.unit} · ${arrears.oldest.days} يوم`
                      : `Oldest: ${arrears.oldest.name} — ${arrears.oldest.building} / ${arrears.oldest.unit} · ${arrears.oldest.days}d`}
                  </p>
                )}
              </div>
            </div>
          </Link>
        ) : (
          <div
            className="flex items-center gap-2 rounded-2xl border border-sage-300/50 bg-sage-100/60 px-4 py-2.5 animate-float-up"
            style={{ animationDelay: "0.08s" }}
          >
            <CheckCircle2 className="h-4 w-4 text-sage-600" />
            <p className="text-xs font-bold text-sage-600">
              {lang === "ar" ? "لا توجد متأخرات 🎉" : "No arrears 🎉"}
            </p>
          </div>
        ))}

        {/* Subscription */}
        <SubscriptionCard />

        {/* Quick actions */}
        {!isEmpty && (
          <div className="grid grid-cols-4 gap-2 md:gap-3 animate-float-up" style={{ animationDelay: "0.12s" }}>
            <QuickAction to="/payments" icon={<Wallet className="h-5 w-5" />} label={lang === "ar" ? "تسجيل دفعة" : "Record"} primary />
            <QuickAction to="/buildings" icon={<Home className="h-5 w-5" />} label={lang === "ar" ? "إضافة وحدة" : "Add Unit"} />
            <QuickAction to="/tenants" icon={<UserPlus className="h-5 w-5" />} label={lang === "ar" ? "مستأجر" : "Tenant"} />
            <QuickAction to="/reports" icon={<BarChart3 className="h-5 w-5" />} label={lang === "ar" ? "تقارير" : "Reports"} />
          </div>
        )}

        {/* Stat cards — 3 equal cards */}
        <div data-tour="dashboard-stats" className="grid grid-cols-3 gap-2 md:gap-4 anim-stagger" style={{ animationDelay: "0.15s" } as React.CSSProperties}>
          <div style={{ ['--i' as any]: 0 }}>
            <StatCard
              icon={<Building2 className="h-4 w-4" />}
              label={t("buildings")}
              value={String(stats.buildings)}
            />
          </div>
          <div style={{ ['--i' as any]: 1 }}>
            <StatCard
              icon={<Home className="h-4 w-4" />}
              label={t("units")}
              value={String(stats.units)}
              subtitle={lang === "ar"
                ? `${stats.rented} مؤجرة · ${stats.vacant} شاغرة`
                : `${stats.rented} rented · ${stats.vacant} vacant`}
            />
          </div>
          <div style={{ ['--i' as any]: 2 }}>
            <StatCard
              icon={<Users className="h-4 w-4" />}
              label={lang === "ar" ? "المستأجرون" : "Tenants"}
              value={String(stats.tenants)}
            />
          </div>
        </div>

        {/* Monthly Collection Snapshot */}
        {!isEmpty && (
          <div
            className="relative block overflow-hidden bg-card border border-sage-200/60 rounded-2xl p-5 shadow-soft animate-float-up"
            style={{ animationDelay: "0.2s" }}
          >
            <div className="relative z-10">
              <div className="flex items-baseline justify-between mb-1">
                <p className="text-xs uppercase tracking-wider text-sage-600 font-bold">
                  {monthOffset === 0
                    ? (lang === "ar" ? "نسبة التحصيل لهذا الشهر" : "This month's collection")
                    : (lang === "ar" ? `نسبة التحصيل — ${monthLabel}` : `Collection — ${monthLabel}`)}
                </p>
                <span className="text-2xl font-black text-sage-600 tabular-nums">{collectionPct}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-sage-100 overflow-hidden mt-2">
                <div
                  className="h-full bg-gradient-sage transition-all duration-700"
                  style={{ width: `${collectionPct}%` }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {lang === "ar"
                    ? `${format(stats.collected)} من ${format(stats.expected)}`
                    : `${format(stats.collected)} of ${format(stats.expected)}`}
                </span>
                <span className="text-sage-600 font-semibold">
                  {lang === "ar"
                    ? `${stats.paidUnits} / ${stats.occupiedUnits} وحدة`
                    : `${stats.paidUnits} / ${stats.occupiedUnits} units`}
                </span>
              </div>
              {collectionContext && (
                <p className="mt-2 text-[11px] text-muted-foreground italic leading-snug">{collectionContext}</p>
              )}
            </div>
          </div>
        )}

        {/* Recent Activity — hidden when empty */}
        <RecentActivityCard limit={8} hideWhenEmpty />

        {/* Empty state */}
        {isEmpty && (
          <div className="bg-card border border-sage-200/60 rounded-3xl p-8 text-center shadow-soft animate-float-up" style={{ animationDelay: "0.25s" }}>
            <div className="inline-flex p-4 rounded-2xl bg-sage-100 mb-3">
              <Building2 className="h-8 w-8 text-sage-400" />
            </div>
            <h3 className="font-bold text-sage-600 text-lg mb-1.5">{t("add_first_building")}</h3>
            <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{t("empty_buildings_msg")}</p>
            <Link to="/buildings">
              <Button className="bg-gradient-sage text-primary-foreground rounded-xl h-12 px-6 font-semibold shadow-soft">
                <Plus className="h-4 w-4 me-1.5" /> {t("add_building")}
              </Button>
            </Link>
          </div>
        )}
      </div>

      {settings.showAiFab && (
        <Link
          to="/assistant"
          aria-label="AI Assistant"
          className="fixed z-40 bottom-24 end-4 h-14 w-14 rounded-full bg-gradient-sage text-primary-foreground shadow-glow grid place-items-center hover:scale-105 transition-transform"
        >
          <Sparkles className="h-6 w-6" />
        </Link>
      )}

      <BottomNav />
    </div>
  );
}

function suffix(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function StatCard({ icon, label, value, subtitle }: { icon: React.ReactNode; label: string; value: string; subtitle?: string }) {
  return (
    <div className="bg-card rounded-2xl p-3 md:p-4 shadow-soft border border-sage-200/40 h-full flex flex-col">
      <div className="inline-flex p-1.5 rounded-lg mb-1.5 bg-sage-100 text-sage-500 self-start">{icon}</div>
      <p className="text-[10px] md:text-xs text-muted-foreground font-medium leading-tight">{label}</p>
      <p className="text-xl md:text-2xl font-black text-sage-600 mt-0.5 tabular-nums">{value}</p>
      {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight truncate">{subtitle}</p>}
    </div>
  );
}

function QuickAction({ to, icon, label, primary }: { to: string; icon: React.ReactNode; label: string; primary?: boolean }) {
  return (
    <Link
      to={to}
      className={`flex flex-col items-center justify-center gap-1 rounded-2xl py-3 px-1 text-center shadow-soft border transition-all hover:-translate-y-0.5 ${
        primary
          ? "bg-gradient-gold text-primary-foreground border-transparent"
          : "bg-card border-sage-200/40 text-sage-600"
      }`}
    >
      <span className={primary ? "text-primary-foreground" : "text-sage-500"}>{icon}</span>
      <span className="text-[11px] font-bold leading-tight">{label}</span>
    </Link>
  );
}

const PLAN_LABEL: Record<string, { ar: string; en: string }> = {
  free: { ar: "مجانية", en: "Free" },
  personal: { ar: "شخصية", en: "Personal" },
  pro: { ar: "احترافية", en: "Pro" },
  business: { ar: "أعمال", en: "Business" },
  enterprise: { ar: "مؤسسات", en: "Enterprise" },
};

function SubscriptionCard() {
  const { t, lang } = useI18n();
  const sub = useSubscription();
  const isAr = lang === "ar";

  const planLabel = (PLAN_LABEL[sub.plan] ?? PLAN_LABEL.free)[isAr ? "ar" : "en"];
  const isPromo = !!sub.paddleSubscriptionId?.startsWith("promo_");

  const fmtDate = (d: Date | null) =>
    d ? d.toLocaleDateString(isAr ? "ar" : "en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";

  let sub_label = "";
  if (sub.loading) {
    sub_label = "";
  } else if (sub.phase === "trial" && sub.trialDaysLeft != null) {
    sub_label = isAr ? `تجربة — ${sub.trialDaysLeft} يوم متبقي` : `Trial — ${sub.trialDaysLeft} days left`;
  } else if (sub.phase === "active" && isPromo && sub.currentPeriodEnd) {
    sub_label = isAr ? `كود ترويجي — حتى ${fmtDate(sub.currentPeriodEnd)}` : `Promo — until ${fmtDate(sub.currentPeriodEnd)}`;
  } else if (sub.phase === "active" && sub.cancelAtPeriodEnd && sub.currentPeriodEnd) {
    sub_label = isAr ? `ملغى — يستمر حتى ${fmtDate(sub.currentPeriodEnd)}` : `Canceled — active until ${fmtDate(sub.currentPeriodEnd)}`;
  } else if (sub.phase === "active" && sub.currentPeriodEnd) {
    sub_label = isAr ? `نشط حتى ${fmtDate(sub.currentPeriodEnd)}` : `Active until ${fmtDate(sub.currentPeriodEnd)}`;
  } else if (sub.phase === "active") {
    sub_label = isAr ? "نشط" : "Active";
  } else if (sub.phase === "subscription_grace" && sub.graceDaysLeft != null) {
    sub_label = isAr ? `فترة سماح — ${sub.graceDaysLeft} يوم` : `Grace period — ${sub.graceDaysLeft} days`;
  } else if (sub.phase === "readonly_grace") {
    sub_label = isAr ? "للقراءة فقط" : "Read-only";
  } else if (sub.phase === "deleted") {
    sub_label = isAr ? "منتهي" : "Expired";
  }

  return (
    <Link
      to="/pricing"
      className="w-full bg-gradient-gold rounded-2xl p-3.5 flex items-center gap-3 shadow-soft animate-float-up"
      style={{ animationDelay: "0.1s" }}
    >
      <span className="text-xl">⚜️</span>
      <div className="text-start flex-1 min-w-0">
        <p className="text-xs text-primary-foreground/80">{t("current_plan")}</p>
        {sub.loading ? (
          <div className="h-4 w-20 mt-0.5 rounded bg-primary-foreground/20 animate-pulse" />
        ) : (
          <p className="font-bold text-primary-foreground text-sm leading-tight">
            {planLabel}
            {sub_label && (
              <span className="font-normal text-primary-foreground/80 text-[11px] block mt-0.5 truncate">
                {sub_label}
              </span>
            )}
          </p>
        )}
      </div>
      <span className="text-primary-foreground rtl:rotate-180">›</span>
    </Link>
  );
}
