import { useEffect, useState } from "react";
import { Plus, Building2, Users, AlertCircle, Clock, TrendingUp } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { BotanicalDecor } from "@/components/BotanicalDecor";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

interface Stats {
  buildings: number;
  units: number;
  overdue: number;
  expiring: number;
  collected: number;
  pending: number;
}

export default function Dashboard() {
  const { t } = useI18n();
  const { format } = useCurrency();
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ buildings: 0, units: 0, overdue: 0, expiring: 0, collected: 0, pending: 0 });
  const [profileName, setProfileName] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).maybeSingle();
      setProfileName(profile?.name || user.email?.split("@")[0] || "");

      // Buildings owned by this user
      const { data: bRows } = await supabase.from("buildings").select("id").eq("user_id", user.id);
      const bIds = (bRows || []).map((b: any) => b.id);
      const buildings = bIds.length;

      if (!bIds.length) {
        setStats({ buildings: 0, units: 0, overdue: 0, expiring: 0, collected: 0, pending: 0 });
        return;
      }

      // Units in those buildings
      const { data: uRows } = await supabase.from("units").select("id, status, rent_amount, contract_end_date").in("building_id", bIds);
      const units = uRows?.length ?? 0;
      const overdue = (uRows || []).filter((u: any) => u.status === "late").length;

      const today = new Date();
      const warnUntil = new Date(); warnUntil.setDate(today.getDate() + 30);
      const expiring = (uRows || []).filter((u: any) => {
        if (!u.contract_end_date) return false;
        const d = new Date(u.contract_end_date);
        return d >= today && d <= warnUntil;
      }).length;

      // Pending = sum of rents on non-paid units
      const pending = (uRows || [])
        .filter((u: any) => u.status !== "paid")
        .reduce((s: number, u: any) => s + Number(u.rent_amount || 0), 0);

      // Collected this month
      const unitIds = (uRows || []).map((u: any) => u.id);
      let collected = 0;
      if (unitIds.length) {
        const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
        const end = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
        const { data: pays } = await supabase.from("payments").select("amount").in("unit_id", unitIds)
          .is("deleted_at", null).gte("payment_date", start).lte("payment_date", end);
        collected = (pays || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
      }

      setStats({ buildings, units, overdue, expiring, collected, pending });
    })();
  }, [user]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return t("good_morning");
    if (h < 18) return t("good_afternoon");
    return t("good_evening");
  })();

  const isEmpty = stats.buildings === 0;

  return (
    <div className="mobile-shell pb-24">
      <TopBar hasAlerts={stats.overdue > 0} />

      <div className="px-5 pt-5 space-y-5">
        <div className="animate-float-up">
          <p className="text-sm text-muted-foreground">{greeting}</p>
          <h1 className="text-2xl font-black text-sage-600 tracking-tight">{profileName} 👋</h1>
        </div>

        {/* Hero card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-sage p-5 text-primary-foreground shadow-glow animate-float-up" style={{ animationDelay: "0.05s" }}>
          <BotanicalDecor className="absolute -end-6 -top-6 w-44 h-44 text-primary-foreground" />
          <div className="relative z-10">
            <p className="text-xs uppercase tracking-wider opacity-80">{t("collected_this_month")}</p>
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
        <div className="grid grid-cols-2 gap-3 animate-float-up" style={{ animationDelay: "0.15s" }}>
          <StatCard icon={<Building2 className="h-4 w-4" />} label={t("buildings")} value={stats.buildings} color="sage-400" />
          <StatCard icon={<Users className="h-4 w-4" />} label={t("units")} value={stats.units} color="sage-500" />
          <StatCard icon={<AlertCircle className="h-4 w-4" />} label={t("overdue")} value={stats.overdue} color="burgundy" />
          <StatCard icon={<Clock className="h-4 w-4" />} label={t("expiring")} value={stats.expiring} color="terracotta" />
        </div>

        {/* Pending */}
        <div className="bg-terracotta/10 border border-terracotta/20 rounded-2xl p-4 flex items-center gap-3 animate-float-up" style={{ animationDelay: "0.2s" }}>
          <div className="h-10 w-10 rounded-xl bg-terracotta/20 flex items-center justify-center">
            <Clock className="h-5 w-5 text-terracotta" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-terracotta/80 font-semibold">{t("pending")}</p>
            <p className="text-lg font-bold text-terracotta">{format(stats.pending)}</p>
          </div>
        </div>

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

      <BottomNav />
    </div>
  );
}

const colorMap: Record<string, string> = {
  "sage-400": "bg-sage-400/10 text-sage-400",
  "sage-500": "bg-sage-500/10 text-sage-500",
  burgundy: "bg-burgundy/10 text-burgundy",
  terracotta: "bg-terracotta/10 text-terracotta",
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
