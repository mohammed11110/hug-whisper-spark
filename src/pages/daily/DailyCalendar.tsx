import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDailyCtx } from "./DailyLayout";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Unit { id: string; name: string }
interface Booking { id: string; unit_id: string; guest_name: string; check_in: string; check_out: string; status: string }

function monthDays(year: number, month: number): Date[] {
  const last = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: last }, (_, i) => new Date(year, month, i + 1));
}
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const STATUS_COLOR: Record<string, string> = {
  confirmed: "bg-sage-300",
  checked_in: "bg-sage-500",
  checked_out: "bg-muted",
  cancelled: "bg-burgundy/30",
  pending: "bg-gold/40",
};

export default function DailyCalendar() {
  const { buildingId } = useDailyCtx();
  const [units, setUnits] = useState<Unit[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [cursor, setCursor] = useState(() => {
    const d = new Date(); d.setDate(1); return d;
  });

  const days = useMemo(() => monthDays(cursor.getFullYear(), cursor.getMonth()), [cursor]);
  const monthLabel = cursor.toLocaleDateString("ar", { month: "long", year: "numeric" });

  useEffect(() => {
    if (!buildingId) return;
    (async () => {
      const start = ymd(days[0]);
      const end = ymd(days[days.length - 1]);
      const [uRes, bRes] = await Promise.all([
        supabase.from("daily_units").select("id,name").eq("building_id", buildingId).eq("active", true).order("name"),
        supabase.from("daily_bookings").select("id,unit_id,guest_name,check_in,check_out,status")
          .eq("building_id", buildingId).neq("status", "cancelled")
          .lte("check_in", end).gte("check_out", start),
      ]);
      setUnits((uRes.data || []) as Unit[]);
      setBookings((bRes.data || []) as Booking[]);
    })();
  }, [buildingId, cursor]);

  const cellBooking = (unitId: string, day: Date) => {
    const ds = ymd(day);
    return bookings.find((b) => b.unit_id === unitId && b.check_in <= ds && b.check_out > ds);
  };

  const move = (delta: number) => {
    const d = new Date(cursor); d.setMonth(d.getMonth() + delta); setCursor(d);
  };
  const today = ymd(new Date());

  return (
    <div className="bg-card rounded-2xl border border-sage-200/40 p-4">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={() => move(-1)}><ChevronRight className="w-4 h-4" /></Button>
        <h3 className="font-black text-sage-700">{monthLabel}</h3>
        <Button variant="ghost" size="icon" onClick={() => move(1)}><ChevronLeft className="w-4 h-4" /></Button>
      </div>

      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th className="sticky right-0 bg-card text-right p-2 min-w-32 z-10 border-b border-sage-200/40">الوحدة</th>
              {days.map((d) => (
                <th key={ymd(d)} className={`w-8 p-1 text-center border-b border-sage-200/40 ${ymd(d) === today ? "bg-sage-100" : ""}`}>
                  <div className="font-bold text-sage-700">{d.getDate()}</div>
                  <div className="text-[10px] text-muted-foreground">{["ح","ن","ث","ر","خ","ج","س"][d.getDay()]}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {units.map((u) => (
              <tr key={u.id}>
                <td className="sticky right-0 bg-card p-2 font-bold text-sage-700 border-b border-sage-100 z-10">{u.name}</td>
                {days.map((d) => {
                  const b = cellBooking(u.id, d);
                  return (
                    <td key={ymd(d)} className="p-0 border-b border-sage-100 align-middle">
                      <div
                        className={`w-8 h-10 mx-auto ${b ? STATUS_COLOR[b.status] : "bg-sage-50"}`}
                        title={b ? `${b.guest_name} (${b.check_in} → ${b.check_out})` : "متاح"}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
            {units.length === 0 && (
              <tr><td colSpan={days.length + 1} className="p-8 text-center text-muted-foreground">لا توجد وحدات</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3 mt-4 text-xs">
        {Object.entries({ confirmed: "مؤكد", checked_in: "ساكن", checked_out: "غادر", pending: "معلق" }).map(([k,v]) => (
          <div key={k} className="flex items-center gap-1.5"><span className={`w-3 h-3 rounded ${STATUS_COLOR[k]}`} />{v}</div>
        ))}
      </div>
    </div>
  );
}
