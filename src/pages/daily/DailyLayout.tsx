import { Outlet, NavLink, useLocation } from "react-router-dom";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { useDailyBuilding } from "@/lib/daily/useDailyBuilding";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  Home,
  Tag,
  Sparkles,
  MessageCircle,
  BarChart3,
} from "lucide-react";
import { createContext, useContext } from "react";

interface DailyCtx {
  buildingId: string | null;
}
const Ctx = createContext<DailyCtx>({ buildingId: null });
export const useDailyCtx = () => useContext(Ctx);

const TABS = [
  { to: "/daily", end: true, label: "نظرة عامة", icon: LayoutDashboard },
  { to: "/daily/calendar", label: "التقويم", icon: CalendarDays },
  { to: "/daily/bookings", label: "الحجوزات", icon: ClipboardList },
  { to: "/daily/units", label: "الوحدات", icon: Home },
  { to: "/daily/pricing", label: "التسعير", icon: Tag },
  { to: "/daily/cleaning", label: "التنظيف", icon: Sparkles },
  { to: "/daily/messages", label: "الرسائل", icon: MessageCircle },
  { to: "/daily/reports", label: "التقارير", icon: BarChart3 },
];

export default function DailyLayout() {
  const { buildings, buildingId, setBuildingId, loading } = useDailyBuilding();
  const { pathname } = useLocation();

  return (
    <div className="min-h-svh bg-cream">
      <TopBar />
      <div className="px-4 md:px-8 pt-4 pb-2">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-sage-700 tracking-tight">
              الإيجارات اليومية
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              إدارة الحجوزات قصيرة المدى بأناقة
            </p>
          </div>
          {!loading && buildings.length > 0 && (
            <Select value={buildingId ?? undefined} onValueChange={setBuildingId}>
              <SelectTrigger className="w-full md:w-64 bg-white border-sage-200/60">
                <SelectValue placeholder="اختر العقار" />
              </SelectTrigger>
              <SelectContent>
                {buildings.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <nav className="mt-4 -mx-1 overflow-x-auto">
          <div className="flex gap-1 min-w-max pb-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = t.end ? pathname === t.to : pathname.startsWith(t.to) && t.to !== "/daily";
              const isOverview = t.end && pathname === "/daily";
              const on = isOverview || active;
              return (
                <NavLink
                  key={t.to}
                  to={t.to}
                  end={t.end}
                  className={() =>
                    `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                      on
                        ? "bg-sage-400 text-white shadow-[0_6px_20px_-8px_rgba(95,126,101,0.5)]"
                        : "bg-white/60 text-sage-600 hover:bg-white border border-sage-200/40"
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </NavLink>
              );
            })}
          </div>
        </nav>
      </div>

      <div className="px-4 md:px-8 pb-24 md:pb-8">
        {buildingId ? (
          <Ctx.Provider value={{ buildingId }}>
            <Outlet />
          </Ctx.Provider>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            {loading ? "جارٍ التحميل…" : "أضف عقاراً أولاً للبدء"}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
