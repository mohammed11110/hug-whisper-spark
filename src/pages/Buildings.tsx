import { useEffect, useState } from "react";
import { Plus, Building2, ArrowUpDown } from "lucide-react";
import { Link } from "react-router-dom";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { BotanicalDecor } from "@/components/BotanicalDecor";
import { AddBuildingDialog } from "@/components/AddBuildingDialog";
import { useI18n } from "@/lib/i18n";
import { useT2 } from "@/lib/i18n2";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu";

interface Building {
  id: string;
  name: string;
  name_en: string | null;
  type: string;
  floors: number;
  city: string | null;
  created_at: string;
}

type SortKey = "newest" | "oldest" | "name_az" | "name_za" | "units_high" | "units_low";

const FILTERS = ["all", "tower", "compound", "villa", "commercial"] as const;

export default function Buildings() {
  const { t } = useI18n();
  const t2 = useT2();
  const { user } = useAuth();
  const [items, setItems] = useState<Building[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>(() => (localStorage.getItem("buildings_sort") as SortKey) || "newest");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("buildings").select("id,name,name_en,type,floors,city,created_at").eq("user_id", user.id).order("created_at", { ascending: false });
    setItems((data || []) as Building[]);
    if (data?.length) {
      const ids = data.map((b) => b.id);
      const { data: us } = await supabase.from("units").select("building_id").in("building_id", ids);
      const c: Record<string, number> = {};
      (us || []).forEach((u) => { c[u.building_id] = (c[u.building_id] || 0) + 1; });
      setCounts(c);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  useEffect(() => { localStorage.setItem("buildings_sort", sortKey); }, [sortKey]);

  const filtered = filter === "all" ? items : items.filter((b) => b.type === filter);
  const visible = [...filtered].sort((a, b) => {
    switch (sortKey) {
      case "oldest": return a.created_at.localeCompare(b.created_at);
      case "name_az": return a.name.localeCompare(b.name);
      case "name_za": return b.name.localeCompare(a.name);
      case "units_high": return (counts[b.id] || 0) - (counts[a.id] || 0);
      case "units_low": return (counts[a.id] || 0) - (counts[b.id] || 0);
      case "newest":
      default: return b.created_at.localeCompare(a.created_at);
    }
  });

  return (
    <div className="mobile-shell pb-24 min-h-screen">
      <TopBar />
      <div className="px-5 pt-5">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-black text-sage-600 tracking-tight">{t("buildings")}</h1>
          <Button onClick={() => setOpen(true)} size="sm" className="rounded-full bg-gradient-sage text-primary-foreground shadow-soft h-9 px-3.5">
            <Plus className="h-4 w-4 me-1" /> {t2("add_unit").includes("ضافة") ? "إضافة" : "Add"}
          </Button>
        </div>

        {/* Filter chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-none">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                filter === f ? "bg-gradient-sage text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground"
              }`}>{t2(f as any)}</button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {loading ? (
            <p className="text-center text-muted-foreground py-10">{t("loading")}</p>
          ) : visible.length === 0 ? (
            <div className="bg-card border border-sage-200/60 rounded-3xl p-8 text-center shadow-soft animate-float-up">
              <div className="inline-flex p-4 rounded-2xl bg-sage-100 mb-3">
                <Building2 className="h-8 w-8 text-sage-400" />
              </div>
              <h3 className="font-bold text-sage-600 text-lg mb-1.5">{t("add_first_building")}</h3>
              <Button onClick={() => setOpen(true)} className="bg-gradient-sage text-primary-foreground rounded-xl h-11 px-5 mt-2 font-semibold">
                <Plus className="h-4 w-4 me-1.5" /> {t("add_building")}
              </Button>
            </div>
          ) : (
            visible.map((b, i) => (
              <Link key={b.id} to={`/buildings/${b.id}`} className="block animate-float-up" style={{ animationDelay: `${i * 0.04}s` }}>
                <div className="relative overflow-hidden rounded-3xl bg-gradient-sage p-5 text-primary-foreground shadow-elev hover:shadow-glow transition-all">
                  <BotanicalDecor className="absolute -end-4 -top-4 w-32 h-32 text-primary-foreground" />
                  <div className="relative z-10">
                    <p className="text-xs uppercase tracking-wider opacity-75">{t2(b.type as any)}</p>
                    <h3 className="text-xl font-black mt-1">{b.name}</h3>
                    {b.name_en && <p className="text-sm opacity-80">{b.name_en}</p>}
                    <div className="flex items-center gap-3 mt-3 text-xs">
                      <span className="bg-card/15 backdrop-blur rounded-full px-2.5 py-1">🏢 {b.floors} {t2("floors")}</span>
                      <span className="bg-card/15 backdrop-blur rounded-full px-2.5 py-1">◉ {counts[b.id] || 0} {t("units")}</span>
                      {b.city && <span className="opacity-80">📍 {b.city}</span>}
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      <AddBuildingDialog open={open} onOpenChange={setOpen} onCreated={load} />
      <BottomNav />
    </div>
  );
}
