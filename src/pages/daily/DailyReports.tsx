import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDailyCtx } from "./DailyLayout";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

interface Booking { total_price: number; check_in: string; source: string; status: string }

const COLORS = ["#5f7e65", "#a89456", "#b8895a", "#7a8e9a", "#2c3a2e"];

export default function DailyReports() {
  const { buildingId } = useDailyCtx();
  const [rows, setRows] = useState<Booking[]>([]);

  useEffect(() => {
    if (!buildingId) return;
    (async () => {
      const { data } = await supabase.from("daily_bookings").select("total_price,check_in,source,status").eq("building_id", buildingId).neq("status", "cancelled");
      setRows((data || []) as Booking[]);
    })();
  }, [buildingId]);

  const monthly = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const m = r.check_in.slice(0, 7);
      map.set(m, (map.get(m) || 0) + Number(r.total_price));
    }
    return Array.from(map.entries()).sort().map(([month, total]) => ({ month, total }));
  }, [rows]);

  const bySource = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.source, (map.get(r.source) || 0) + 1);
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [rows]);

  const totalRevenue = rows.reduce((s, r) => s + Number(r.total_price), 0);
  const totalBookings = rows.length;
  const avg = totalBookings ? totalRevenue / totalBookings : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {[
          { l: "إجمالي الإيرادات", v: `${totalRevenue.toFixed(0)} ر.ع` },
          { l: "عدد الحجوزات", v: totalBookings },
          { l: "متوسط الحجز", v: `${avg.toFixed(0)} ر.ع` },
        ].map((c) => (
          <div key={c.l} className="bg-card rounded-2xl border border-sage-200/40 p-5">
            <div className="text-xs text-muted-foreground">{c.l}</div>
            <div className="text-2xl font-black text-sage-700 mt-1">{c.v}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card rounded-2xl border border-sage-200/40 p-5">
          <h3 className="font-black text-sage-700 mb-4">الإيرادات الشهرية</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthly}>
              <XAxis dataKey="month" stroke="#7a8e9a" fontSize={12} />
              <YAxis stroke="#7a8e9a" fontSize={12} />
              <Tooltip />
              <Bar dataKey="total" fill="#5f7e65" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card rounded-2xl border border-sage-200/40 p-5">
          <h3 className="font-black text-sage-700 mb-4">مصادر الحجوزات</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={bySource} dataKey="value" nameKey="name" outerRadius={90}>
                {bySource.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
