import { useEffect, useMemo, useState } from "react";
import { Plus, Building2, ArrowUpDown, Search, X } from "lucide-react";
import { Link } from "react-router-dom";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { AddBuildingDialog } from "@/components/AddBuildingDialog";
import { useI18n } from "@/lib/i18n";
import { useT2 } from "@/lib/i18n2";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import { supabase } from "@/integrations/supabase/client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu";

interface Building {
  id: string;
  name: string;
  name_en: string | null;
  type: string;
  floors: number;
  city: string | null;
  created_at: string;
}

interface BuildingStats {
  total: number;
  occupied: number;
  hasArrears: boolean;
  allCollected: boolean;
  collectedMonth: number;
  expectedMonth: number;
}

type SortKey = "newest" | "oldest" | "name_az" | "name_za" | "units_high" | "units_low";

const FILTERS = ["all", "tower", "compound", "villa", "commercial"] as const;

export default function Buildings() {
  const { t, lang } = useI18n();
  const t2 = useT2();
  const { user } = useAuth();
  const { format } = useCurrency();
  const [items, setItems] = useState<Building[]>([]);
  const [bStats, setBStats] = useState<Record<string, BuildingStats>>({});
  const [filter, setFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>(() => (localStorage.getItem("buildings_sort") as SortKey) || "newest");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [collectedThisMonth, setCollectedThisMonth] = useState(0);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("buildings").select("id,name,name_en,type,floors,city,created_at").eq("user_id", user.id).order("created_at", { ascending: false });
    setItems((data || []) as Building[]);

    if (data?.length) {
      const ids = data.map((b) => b.id);
      const { data: us } = await supabase.from("units").select("id, building_id, status, rent_amount, tenant_name").in("building_id", ids);
      const unitsByBuilding: Record<string, any[]> = {};
      (us || []).forEach((u: any) => {
        (unitsByBuilding[u.building_id] ||= []).push(u);
      });

      // Payments for this month
      const today = new Date();
      const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
      const unitIds = (us || []).map((u: any) => u.id);
      const paidUnitIds = new Set<string>();
      const perBuildingCollected: Record<string, number> = {};
      let monthSum = 0;
      if (unitIds.length) {
        const { data: pays } = await supabase
          .from("payments")
          .select("unit_id, amount, period_start, payment_date")
          .in("unit_id", unitIds)
          .is("deleted_at", null);
        const unitToBuilding = new Map<string, string>((us || []).map((u: any) => [u.id, u.building_id]));
        (pays || []).forEach((p: any) => {
          const k = ((p.period_start || p.payment_date) || "").slice(0, 7);
          if (k === monthKey) {
            paidUnitIds.add(p.unit_id);
            monthSum += Number(p.amount || 0);
            const bId = unitToBuilding.get(p.unit_id);
            if (bId) perBuildingCollected[bId] = (perBuildingCollected[bId] || 0) + Number(p.amount || 0);
          }
        });
      }
      setCollectedThisMonth(monthSum);

      const stats: Record<string, BuildingStats> = {};
      for (const b of data) {
        const list = unitsByBuilding[b.id] || [];
        const occupied = list.filter((u) => !!u.tenant_name);
        const expectedMonth = occupied.reduce((sum, u) => sum + Number(u.rent_amount || 0), 0);
        const collectedMonth = perBuildingCollected[b.id] || 0;
        const allCollected = occupied.length > 0 && occupied.every((u) => paidUnitIds.has(u.id));
        const hasArrears = !allCollected && occupied.some((u) => !paidUnitIds.has(u.id)) && collectedMonth > 0
          ? false // partial — handled as in-progress
          : occupied.length > 0 && collectedMonth === 0 && new Date().getDate() > 10;
        stats[b.id] = {
          total: list.length,
          occupied: occupied.length,
          hasArrears,
          allCollected,
          collectedMonth,
          expectedMonth,
        };
      }
      setBStats(stats);
    } else {
      setBStats({});
      setCollectedThisMonth(0);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);
  useEffect(() => { localStorage.setItem("buildings_sort", sortKey); }, [sortKey]);

  const filtered = filter === "all" ? items : items.filter((b) => b.type === filter);
  const searched = search.trim()
    ? filtered.filter((b) => {
        const q = search.trim().toLowerCase();
        return (
          b.name.toLowerCase().includes(q) ||
          (b.name_en || "").toLowerCase().includes(q) ||
          (b.city || "").toLowerCase().includes(q)
        );
      })
    : filtered;
  const visible = [...searched].sort((a, b) => {
    switch (sortKey) {
      case "oldest": return a.created_at.localeCompare(b.created_at);
      case "name_az": return a.name.localeCompare(b.name);
      case "name_za": return b.name.localeCompare(a.name);
      case "units_high": return (bStats[b.id]?.total || 0) - (bStats[a.id]?.total || 0);
      case "units_low": return (bStats[a.id]?.total || 0) - (bStats[b.id]?.total || 0);
      case "newest":
      default: return b.created_at.localeCompare(a.created_at);
    }
  });

  // KPI totals
  const totals = useMemo(() => {
    let units = 0;
    let occupied = 0;
    for (const b of items) {
      units += bStats[b.id]?.total || 0;
      occupied += bStats[b.id]?.occupied || 0;
    }
    const occupancyPct = units > 0 ? Math.round((occupied / units) * 100) : 0;
    return { buildings: items.length, units, occupancyPct };
  }, [items, bStats]);

  const fmt = (n: number) => new Intl.NumberFormat(lang === "ar" ? "ar" : "en").format(n);

  return (
    <div className="mobile-shell pb-24 md:pb-8 min-h-screen">
      <TopBar />
      <div className="px-5 md:px-8 lg:px-12 pt-5">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-black text-sage-600 tracking-tight">{t("buildings")}</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setSearchOpen((s) => !s); if (searchOpen) setSearch(""); }}
              className="rounded-full h-9 w-9 p-0 border-sage-200 text-sage-600 bg-card"
              aria-label="Search"
            >
              {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-full h-9 px-3 border-sage-200 text-sage-600 bg-card">
                  <ArrowUpDown className="h-4 w-4 me-1" /> {t2("sort")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-2xl">
                <DropdownMenuLabel>{t2("sort")}</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                  <DropdownMenuRadioItem value="newest">{t2("sort_newest")}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="oldest">{t2("sort_oldest")}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="name_az">{t2("sort_name_az")}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="name_za">{t2("sort_name_za")}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="units_high">{t2("sort_units_high")}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="units_low">{t2("sort_units_low")}</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button data-tour="add-building" onClick={() => setOpen(true)} size="sm" className="rounded-full bg-gradient-sage text-primary-foreground shadow-soft h-9 px-3.5">
              <Plus className="h-4 w-4 me-1" /> {t2("add_unit").includes("ضافة") ? "إضافة" : "Add"}
            </Button>
          </div>
        </div>

        {/* Search bar */}
        {searchOpen && (
          <div className="mb-3 animate-float-up">
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={lang === "ar" ? "ابحث بالاسم أو المدينة…" : "Search by name or city…"}
              className="rounded-xl border-sage-200 bg-card h-10"
            />
          </div>
        )}

        {/* KPI bar */}
        {!loading && items.length > 0 && (
          <div className="mb-4 bg-card border border-sage-200/60 rounded-2xl shadow-soft animate-float-up overflow-hidden">
            <div className="grid grid-cols-4 divide-x divide-sage-100 rtl:divide-x-reverse">
              <Kpi label={lang === "ar" ? "مبانٍ" : "Buildings"} value={fmt(totals.buildings)} />
              <Kpi label={lang === "ar" ? "وحدات" : "Units"} value={fmt(totals.units)} />
              <Kpi label={lang === "ar" ? "الإشغال" : "Occupancy"} value={`${totals.occupancyPct}%`} highlight />
              <Kpi label={lang === "ar" ? "تحصيل الشهر" : "This month"} value={fmt(Math.round(collectedThisMonth))} />
            </div>
          </div>
        )}

        {/* Filter chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-none">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                filter === f ? "bg-gradient-sage text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground"
              }`}>{t2(f as any)}</button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
          {loading ? (
            <p className="text-center text-muted-foreground py-10">{t("loading")}</p>
          ) : visible.length === 0 ? (
            <div className="bg-card border border-sage-200/60 rounded-3xl p-8 text-center shadow-soft animate-float-up">
              <div className="inline-flex p-4 rounded-2xl bg-sage-100 mb-3">
                <Building2 className="h-8 w-8 text-sage-400" />
              </div>
              <h3 className="font-bold text-sage-600 text-lg mb-1.5">
                {search.trim() || filter !== "all"
                  ? (lang === "ar" ? "لا توجد نتائج" : "No results")
                  : t("add_first_building")}
              </h3>
              {!search.trim() && filter === "all" && (
                <Button onClick={() => setOpen(true)} className="bg-gradient-sage text-primary-foreground rounded-xl h-11 px-5 mt-2 font-semibold">
                  <Plus className="h-4 w-4 me-1.5" /> {t("add_building")}
                </Button>
              )}
            </div>
          ) : (
            visible.map((b, i) => {
              const s = bStats[b.id] || { total: 0, occupied: 0, hasArrears: false, allCollected: false };
              const occPct = s.total > 0 ? Math.round((s.occupied / s.total) * 100) : 0;
              const statusDotClass = s.hasArrears
                ? "bg-terracotta"
                : s.allCollected
                ? "bg-gold"
                : "bg-sage-300";
              const statusLabel = s.hasArrears
                ? (lang === "ar" ? "متأخرات" : "Arrears")
                : s.allCollected
                ? (lang === "ar" ? "محصّل بالكامل" : "Fully collected")
                : (lang === "ar" ? "قيد التحصيل" : "In progress");
              return (
                <Link key={b.id} to={`/buildings/${b.id}`} className="block animate-float-up" style={{ animationDelay: `${i * 0.04}s` }}>
                  <div className="relative overflow-hidden rounded-3xl bg-gradient-sage p-5 text-primary-foreground shadow-elev hover:shadow-glow transition-all">
                    
                    {/* status dot */}
                    <div className="absolute top-3 start-3 z-10 flex items-center gap-1.5 bg-card/15 backdrop-blur rounded-full px-2 py-0.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass}`} />
                      <span className="text-[10px] font-semibold opacity-90">{statusLabel}</span>
                    </div>
                    <div className="relative z-10 mt-5">
                      <p className="text-xs uppercase tracking-wider opacity-75">{t2(b.type as any)}</p>
                      <h3 className="text-xl font-black mt-1">{b.name}</h3>
                      {b.name_en && <p className="text-sm opacity-80">{b.name_en}</p>}
                      <div className="flex items-center gap-2 flex-wrap mt-3 text-xs">
                        <span className="bg-card/15 backdrop-blur rounded-full px-2.5 py-1">🏢 {b.floors} {t2("floors")}</span>
                        <span className="bg-card/15 backdrop-blur rounded-full px-2.5 py-1">◉ {s.occupied}/{s.total} {lang === "ar" ? "مشغول" : "occupied"}</span>
                        {b.city && <span className="opacity-80">📍 {b.city}</span>}
                      </div>
                      {/* occupancy bar */}
                      {s.total > 0 && (
                        <div className="mt-3 h-1 rounded-full bg-card/20 overflow-hidden">
                          <div className="h-full bg-primary-foreground/80" style={{ width: `${occPct}%` }} />
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>

      <AddBuildingDialog open={open} onOpenChange={setOpen} onCreated={load} />
      <BottomNav />
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="px-3 py-3 text-center">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
      <p className={`mt-1 text-lg font-black tabular-nums ${highlight ? "text-sage-500" : "text-sage-600"}`}>{value}</p>
    </div>
  );
}
