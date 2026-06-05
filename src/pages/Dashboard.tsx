import { useEffect, useMemo, useState } from "react";
import { Plus, Building2, Users, TrendingUp, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";

import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { BotanicalDecor } from "@/components/BotanicalDecor";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { useAuth } from "@/lib/auth";
import { useAppSettings } from "@/lib/appSettings";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";
import { useCountUp } from "@/hooks/useCountUp";


interface Stats {
  buildings: number;
  units: number;
  collected: number;
  expected: number;
  paidUnits: number;
  occupiedUnits: number;
}

export default function Dashboard() {
  const { t, lang } = useI18n();
  const { format } = useCurrency();
  const { user } = useAuth();
  const { settings } = useAppSettings();
  const [stats, setStats] = useState<Stats>({ buildings: 0, units: 0, collected: 0, expected: 0, paidUnits: 0, occupiedUnits: 0 });
  const [profileName, setProfileName] = useState("");
  const [monthOffset, setMonthOffset] = useState(0);
  const [allPayments, setAllPayments] = useState<any[]>([]);
  const [expectedBase, setExpectedBase] = useState(0);
  const [occupiedCount, setOccupiedCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).maybeSingle();
      setProfileName(profile?.name || user.email?.split("@")[0] || "");

      const { data: bRows } = await supabase.from("buildings").select("id").eq("user_id", user.id);
      const bIds = (bRows || []).map((b: any) => b.id);
      const buildings = bIds.length;

      if (!bIds.length) {
        setStats({ buildings: 0, units: 0, collected: 0, expected: 0, paidUnits: 0, occupiedUnits: 0 });
        setAllPayments([]);
        return;
      }

      const { data: uRows } = await supabase.from("units").select("id, status, rent_amount").in("building_id", bIds);
      const units = uRows?.length ?? 0;
      const occupied = (uRows || []).filter((u: any) => u.status !== "vacant");
      const expected = occupied.reduce((s: number, u: any) => s + Number(u.rent_amount || 0), 0);
      setExpectedBase(expected);
      setOccupiedCount(occupied.length);

      const unitIds = (uRows || []).map((u: any) => u.id);
      if (unitIds.length) {
        const { data: pays } = await supabase.from("payments").select("amount, unit_id, payment_date, period_start").in("unit_id", unitIds).is("deleted_at", null);
        setAllPayments(pays || []);
      } else {
        setAllPayments([]);
      }

      setStats((s) => ({ ...s, buildings, units, expected, occupiedUnits: occupied.length }));
    })();
  }, [user]);

  // Selected month key from offset
  const { monthKey, monthLabel } = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString(lang === "ar" ? "ar" : "en", { month: "long", year: "numeric" });
    return { monthKey: key, monthLabel: label };
  }, [monthOffset, lang]);

  // Recompute collected for selected month
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


  return (
    <div className="mobile-shell pb-24 md:pb-8">
      <TopBar />

      <div className="px-5 md:px-8 lg:px-12 pt-5 space-y-5 md:space-y-6">
        <div className="animate-float-up">
          <p className="text-sm text-muted-foreground">{greeting}</p>
          <h1 className="text-2xl font-black text-sage-600 tracking-tight">{profileName} 👋</h1>
        </div>

        {/* Hero card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-sage p-5 text-primary-foreground shadow-glow animate-float-up" style={{ animationDelay: "0.05s" }}>
          <BotanicalDecor className="absolute -end-6 -top-6 w-44 h-44 text-primary-foreground" />
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
            <p className="text-4xl font-black mt-2">{format(stats.collected)}</p>
            <div className="mt-3 inline-flex items-center gap-1 bg-card/15 backdrop-blur rounded-full px-2.5 py-1 text-xs">
              <TrendingUp className="h-3 w-3" /> +0%
            </div>
          </div>
        </div>


        {/* Subscription */}
        <button className="w-full bg-gradient-gold rounded-2xl p-3.5 flex items-center gap-3 shadow-soft animate-float-up" style={{ animationDelay: "0.1s" }}>
          <span className="text-xl">⚜️</span>
          <div className="text-start flex-1">
            <p className="text-xs text-primary-foreground/80">{t("current_plan")}</p>
            <p className="font-bold text-primary-foreground uppercase text-sm">{t("free")}</p>
          </div>
          <span className="text-primary-foreground rtl:rotate-180">›</span>
        </button>

        {/* Mini stats */}
        <div data-tour="dashboard-stats" className="grid grid-cols-2 gap-3 md:gap-4 animate-float-up" style={{ animationDelay: "0.15s" }}>
          <StatCard icon={<Building2 className="h-4 w-4" />} label={t("buildings")} value={stats.buildings} color="sage-400" />
          <StatCard icon={<Users className="h-4 w-4" />} label={t("units")} value={stats.units} color="sage-500" />
        </div>

        {/* Monthly Collection Snapshot */}
        {!isEmpty && (
          <div
            className="relative block overflow-hidden bg-card border border-sage-200/60 rounded-2xl p-5 shadow-soft animate-float-up"
            style={{ animationDelay: "0.2s" }}
          >
            <BotanicalDecor className="absolute -end-8 -bottom-8 w-32 h-32 text-sage-400 opacity-10" />
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
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <RecentActivityCard limit={8} />

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

const colorMap: Record<string, string> = {
  "sage-400": "bg-sage-400/10 text-sage-400",
  "sage-500": "bg-sage-500/10 text-sage-500",
};

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="bg-card rounded-2xl p-4 shadow-soft border border-sage-200/40">
      <div className={`inline-flex p-2 rounded-lg mb-2 ${colorMap[color]}`}>{icon}</div>
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className="text-2xl font-black text-sage-600 mt-0.5">{value}</p>
    </div>
  );
}
