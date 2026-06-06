import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDailyCtx } from "./DailyLayout";
import { Home, TrendingUp, Wallet, Sparkles } from "lucide-react";

interface Stat {
  units: number;
  occupied_today: number;
  revenue_month: number;
  pending_cleanings: number;
}

export default function DailyDashboard() {
  const { buildingId } = useDailyCtx();
  const [s, setS] = useState<Stat>({ units: 0, occupied_today: 0, revenue_month: 0, pending_cleanings: 0 });
  const [today, setToday] = useState<{ ins: any[]; outs: any[] }>({ ins: [], outs: [] });

  useEffect(() => {
    if (!buildingId) return;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const firstOfMonth = today.slice(0, 7) + "-01";

    (async () => {
      const [unitsRes, bookingsRes, cleansRes, todayInRes, todayOutRes] = await Promise.all([
        supabase.from("daily_units").select("id", { count: "exact", head: true }).eq("building_id", buildingId).eq("active", true),
        supabase.from("daily_bookings").select("total_price, check_in, check_out, status").eq("building_id", buildingId).gte("check_in", firstOfMonth).neq("status", "cancelled"),
        supabase.from("daily_cleaning_tasks").select("id", { count: "exact", head: true }).eq("building_id", buildingId).eq("status", "pending"),
        supabase.from("daily_bookings").select("id,guest_name,unit_id,check_in").eq("building_id", buildingId).eq("check_in", today).neq("status", "cancelled"),
        supabase.from("daily_bookings").select("id,guest_name,unit_id,check_out").eq("building_id", buildingId).eq("check_out", today).neq("status", "cancelled"),
      ]);

      const bookings = (bookingsRes.data || []) as any[];
      const occToday = bookings.filter((b) => b.check_in <= today && b.check_out > today).length;
      const revenue = bookings.reduce((sum, b) => sum + Number(b.total_price || 0), 0);

      setS({
        units: unitsRes.count || 0,
        occupied_today: occToday,
        revenue_month: revenue,
        pending_cleanings: cleansRes.count || 0,
      });
      setToday({ ins: todayInRes.data || [], outs: todayOutRes.data || [] });
    })();
  }, [buildingId]);

  const cards = [
    { label: "الوحدات", value: s.units, icon: Home, tone: "bg-sage-100 text-sage-700" },
    { label: "محجوزة اليوم", value: `${s.occupied_today} / ${s.units}`, icon: TrendingUp, tone: "bg-sage-200/60 text-sage-700" },
    { label: "إيرادات الشهر", value: `${s.revenue_month.toFixed(0)} ر.ع`, icon: Wallet, tone: "bg-gold/15 text-gold" },
    { label: "تنظيفات معلقة", value: s.pending_cleanings, icon: Sparkles, tone: "bg-terracotta/15 text-terracotta" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-card rounded-2xl border border-sage-200/40 p-5 shadow-[0_4px_18px_-12px_rgba(95,126,101,0.3)]">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.tone}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="mt-3 text-2xl font-black text-sage-700">{c.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{c.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card rounded-2xl border border-sage-200/40 p-5">
          <h3 className="font-black text-sage-700 mb-3">دخول اليوم</h3>
          {today.ins.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا يوجد</p>
          ) : (
            <ul className="space-y-2">
              {today.ins.map((b) => (
                <li key={b.id} className="flex justify-between text-sm border-b border-sage-100 pb-2">
                  <span className="font-bold">{b.guest_name}</span>
                  <span className="text-sage-600">{b.check_in}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-card rounded-2xl border border-sage-200/40 p-5">
          <h3 className="font-black text-sage-700 mb-3">مغادرة اليوم</h3>
          {today.outs.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا يوجد</p>
          ) : (
            <ul className="space-y-2">
              {today.outs.map((b) => (
                <li key={b.id} className="flex justify-between text-sm border-b border-sage-100 pb-2">
                  <span className="font-bold">{b.guest_name}</span>
                  <span className="text-terracotta">{b.check_out}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
