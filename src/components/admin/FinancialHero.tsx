import { useEffect, useState } from "react";
import { TrendingUp, Users, AlertTriangle, DollarSign, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { useCurrency } from "@/lib/currency";

interface Stats {
  mrr: number;
  paid_users: number;
  arpu: number;
  total_users: number;
  new_users_30d: number;
  canceled_30d: number;
  conversion_rate: number;
  churn_rate: number;
}

const COST_KEY = "amlaki_admin_monthly_cost";

export function FinancialHero() {
  const { format } = useCurrency();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [cost, setCost] = useState<number>(() => {
    const v = typeof window !== "undefined" ? localStorage.getItem(COST_KEY) : null;
    return v ? Number(v) || 0 : 100;
  });

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("admin_financial_stats" as any);
      if (!error && data) setStats(data as unknown as Stats);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    localStorage.setItem(COST_KEY, String(cost));
  }, [cost]);

  if (loading) {
    return <div className="rounded-3xl bg-card border border-border/40 p-6 text-sm text-muted-foreground">جارٍ تحميل التحليلات…</div>;
  }
  if (!stats) {
    return <div className="rounded-3xl bg-card border border-burgundy/30 p-6 text-sm text-burgundy">تعذّر تحميل التحليلات المالية</div>;
  }

  const mrr = Number(stats.mrr || 0);
  const netProfit = mrr - cost;
  const margin = mrr > 0 ? (netProfit / mrr) * 100 : 0;
  const dangerLow = netProfit <= 0;
  const warnLow = !dangerLow && margin < 25;

  return (
    <div className="space-y-3">
      {/* Hero: Midnight + Gold in both modes */}
      <div className="relative overflow-hidden rounded-[28px] p-6 shadow-xl"
           style={{ background: "linear-gradient(135deg, #0e1118 0%, #1a1f2b 100%)" }}>
        <div className="absolute -top-20 -end-20 h-48 w-48 rounded-full opacity-20"
             style={{ background: "radial-gradient(circle, #c9a44c 0%, transparent 70%)" }} />

        <div className="relative">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" style={{ color: "#c9a44c" }} />
              <p className="text-xs font-bold tracking-wide" style={{ color: "#c9a44c" }}>
                الأداء المالي للأعمال
              </p>
            </div>
            {dangerLow && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-burgundy/20 text-burgundy-foreground"
                    style={{ color: "#e09a9a" }}>
                <AlertTriangle className="h-3 w-3" /> خسارة
              </span>
            )}
            {warnLow && (
              <span className="text-[10px] font-bold px-2 py-1 rounded-full"
                    style={{ background: "rgba(184,132,31,0.2)", color: "#c9a44c" }}>
                هامش منخفض
              </span>
            )}
          </div>

          {/* Net Profit — big */}
          <div className="mt-3">
            <p className="text-[11px]" style={{ color: "#9ca3af" }}>صافي الربح / شهر</p>
            <p className="text-4xl font-black mt-1 tracking-tight"
               style={{ color: dangerLow ? "#e09a9a" : "#c9a44c" }}>
              {format(netProfit)}
            </p>
            <p className="text-[11px] mt-1" style={{ color: "#9ca3af" }}>
              {margin.toFixed(1)}% هامش · MRR − التكلفة
            </p>
          </div>

          {/* MRR / ARPU / Cost row */}
          <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t" style={{ borderColor: "rgba(201,164,76,0.15)" }}>
            <HeroStat label="MRR" value={format(mrr)} sub={`${stats.paid_users} مشترك`} />
            <HeroStat label="ARPU" value={format(Number(stats.arpu || 0))} sub="لكل مستخدم" />
            <div>
              <p className="text-[10px] uppercase tracking-wider" style={{ color: "#9ca3af" }}>التكلفة</p>
              <Input
                type="number"
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(Math.max(0, Number(e.target.value) || 0))}
                className="mt-1 h-8 px-2 text-sm font-bold border-0 bg-transparent focus-visible:ring-1 focus-visible:ring-offset-0"
                style={{ color: "#e8eaed", background: "rgba(255,255,255,0.05)" }}
              />
              <p className="text-[10px] mt-0.5" style={{ color: "#9ca3af" }}>قابلة للتعديل</p>
            </div>
          </div>
        </div>
      </div>

      {/* Conversion & Churn */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          icon={<ArrowUpRight className="h-4 w-4" />}
          label="معدل التحويل"
          value={`${(stats.conversion_rate * 100).toFixed(1)}%`}
          sub={`${stats.paid_users}/${stats.total_users} مدفوع`}
          tone="success"
        />
        <MetricCard
          icon={<ArrowDownRight className="h-4 w-4" />}
          label="معدل التسرب (30 يوم)"
          value={`${(stats.churn_rate * 100).toFixed(1)}%`}
          sub={`${stats.canceled_30d} إلغاء`}
          tone={stats.churn_rate > 0.1 ? "danger" : "muted"}
        />
      </div>
    </div>
  );
}

function HeroStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider" style={{ color: "#9ca3af" }}>{label}</p>
      <p className="text-base font-black mt-1" style={{ color: "#e8eaed" }}>{value}</p>
      <p className="text-[10px] mt-0.5" style={{ color: "#9ca3af" }}>{sub}</p>
    </div>
  );
}

function MetricCard({ icon, label, value, sub, tone }: {
  icon: React.ReactNode; label: string; value: string; sub: string;
  tone: "success" | "danger" | "muted";
}) {
  const toneClass =
    tone === "success" ? "bg-sage-400/10 text-sage-500"
    : tone === "danger" ? "bg-burgundy/10 text-burgundy"
    : "bg-muted text-muted-foreground";
  return (
    <div className="bg-card rounded-2xl p-4 border border-border/40 shadow-soft">
      <div className={`inline-flex p-2 rounded-lg mb-2 ${toneClass}`}>{icon}</div>
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className="text-2xl font-black text-foreground mt-0.5">{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}
