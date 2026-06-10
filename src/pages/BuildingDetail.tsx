import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Trash2, Plus, Home, Pencil, Wallet, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { AddUnitDialog } from "@/components/AddUnitDialog";
import { EditUnitDialog } from "@/components/EditUnitDialog";
import { useI18n } from "@/lib/i18n";
import { useT2 } from "@/lib/i18n2";
import { useCurrency } from "@/lib/currency";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getNextDueInfo, type PaymentForBalance } from "@/lib/balance";
import { ArrearsBadge } from "@/components/ArrearsBadge";
import { useLiveData } from "@/lib/useLiveData";

interface Building { id: string; name: string; name_en: string | null; type: string; floors: number; city: string | null; address: string | null; }
interface Unit { id: string; unit_number: string; floor: number; type: string; tenant_name: string | null; tenant_phone: string | null; rent_amount: number; rent_type: string; rent_timing?: string | null; status: string; due_day: number; security_deposit?: number; deposit_status?: string; opening_balance?: number; opening_balance_date?: string | null; contract_start_date?: string | null; last_paid_date?: string | null; }

const UNIT_FILTERS = ["all", "apartment", "shop", "room", "villa"] as const;

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-sage-300/30 text-sage-600",
  late: "bg-burgundy/15 text-burgundy",
  soon: "bg-terracotta/15 text-terracotta",
  vacant: "bg-sage-100 text-sage-500 border border-sage-200",
};

export default function BuildingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const t2 = useT2();
  const { format } = useCurrency();
  const [building, setBuilding] = useState<Building | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [payments, setPayments] = useState<PaymentForBalance[]>([]);
  const [collectedMonth, setCollectedMonth] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [filter, setFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>(() => {
    try { return localStorage.getItem("amlaki.units.sortBy") || "smart"; } catch { return "smart"; }
  });
  useEffect(() => {
    try { localStorage.setItem("amlaki.units.sortBy", sortBy); } catch {}
  }, [sortBy]);
  const [search, setSearch] = useState("");
  const [delOpen, setDelOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editUnit, setEditUnit] = useState<Unit | null>(null);

  const load = async () => {
    if (!id) return;
    const { data: b } = await supabase.from("buildings").select("*").eq("id", id).maybeSingle();
    setBuilding(b);
    const { data: us } = await supabase.from("units").select("id,unit_number,floor,type,tenant_name,tenant_phone,rent_amount,rent_type,rent_timing,status,due_day,security_deposit,deposit_status,opening_balance,opening_balance_date,contract_start_date,last_paid_date").eq("building_id", id).order("floor").order("unit_number");
    setUnits((us || []) as any);
    const ids = (us || []).map((u: any) => u.id);
    if (ids.length) {
      const { data: ps } = await supabase.from("payments").select("unit_id,amount,deleted_at,payment_date,period_start,period_end").in("unit_id", ids).is("deleted_at", null);
      setPayments((ps || []) as any);
      const today = new Date();
      const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
      const monthSum = (ps || [])
        .filter((p: any) => ((p.period_start || p.payment_date) || "").slice(0, 7) === monthKey)
        .reduce((s: number, p: any) => s + Number(p.amount), 0);
      setCollectedMonth(monthSum);
    } else { setPayments([]); setCollectedMonth(0); }
    const { data: exs } = await supabase.from("expenses").select("amount,cancelled_at").eq("building_id", id).is("cancelled_at", null);
    setTotalExpenses((exs || []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0));
  };

  useEffect(() => { load(); }, [id]);
  useLiveData(["units", "tenancies", "payments", "expenses", "buildings"], load);
  useEffect(() => {
    let unsub: (() => void) | null = null;
    import("@/lib/paymentsBus").then(({ paymentsBus }) => {
      unsub = paymentsBus.subscribe(() => load());
    });
    return () => { if (unsub) unsub(); };
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    const { error } = await supabase.from("buildings").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("✓");
    navigate("/buildings");
  };

  const numOf = (s: string) => {
    const m = String(s || "").match(/\d+/);
    return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
  };
  const statusRank = (s: string) => (s === "vacant" ? 2 : 0);
  const dueDayDistance = (u: Unit) => {
    if (u.status === "vacant") return Number.MAX_SAFE_INTEGER;
    const today = new Date();
    const info = getNextDueInfo(u as any, payments as any);
    if (info) {
      const diff = Math.ceil((info.nextDueDate.getTime() - today.getTime()) / 86400000);
      // المتأخّر يأتي أولاً (قيمة سالبة → نُعيدها 0 لأقصى أولوية)
      return Math.max(0, diff);
    }
    // fallback to legacy due_day
    const day = today.getDate();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const due = Math.min(Math.max(1, u.due_day || 1), lastDay);
    let diff = due - day;
    if (diff < 0) diff += lastDay;
    return diff;
  };
  const filteredByType = filter === "all" ? units : units.filter((u) => u.type === filter);
  const q = search.trim().toLowerCase();
  const filteredBySearch = !q ? filteredByType : filteredByType.filter((u) =>
    (u.tenant_name || "").toLowerCase().includes(q) ||
    (u.tenant_phone || "").toLowerCase().includes(q) ||
    String(u.unit_number).toLowerCase().includes(q)
  );
  const visible = [...filteredBySearch].sort((a, b) => {
    if (sortBy === "number") {
      return numOf(a.unit_number) - numOf(b.unit_number) || String(a.unit_number).localeCompare(String(b.unit_number));
    }
    if (sortBy === "name") {
      return (a.tenant_name || "zzz").localeCompare(b.tenant_name || "zzz");
    }
    if (sortBy === "vacant") {
      const av = a.status === "vacant" ? 0 : 1;
      const bv = b.status === "vacant" ? 0 : 1;
      if (av !== bv) return av - bv;
      return numOf(a.unit_number) - numOf(b.unit_number);
    }
    if (sortBy === "due") {
      return dueDayDistance(a) - dueDayDistance(b);
    }
    // smart (default): occupied first, due nearest, then vacant
    const sr = statusRank(a.status) - statusRank(b.status);
    if (sr !== 0) return sr;
    if (a.status !== "vacant" && b.status !== "vacant") {
      const dd = dueDayDistance(a) - dueDayDistance(b);
      if (dd !== 0) return dd;
    }
    return numOf(a.unit_number) - numOf(b.unit_number);
  });
  const occupied = units.filter((u) => u.status !== "vacant").length;
  const occupancy = units.length ? Math.round((occupied / units.length) * 100) : 0;
  const vacancy = units.length ? 100 - occupancy : 0;
  const monthRents = units
    .filter((u) => u.status !== "vacant")
    .reduce((s, u) => {
      const r = Number(u.rent_amount) || 0;
      if (u.rent_type === "monthly") return s + r;
      if (u.rent_type === "yearly") return s + r / 12;
      if (u.rent_type === "daily") {
        const days = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        return s + r * days;
      }
      return s;
    }, 0);

  if (!building) return <div className="mobile-shell flex items-center justify-center min-h-screen"><p className="text-sage-500">{t("loading")}</p></div>;

  return (
    <div className="mobile-shell min-h-screen pb-10">
      {/* Hero header */}
      <div className="relative overflow-hidden bg-gradient-deep text-primary-foreground pt-4 pb-6 px-5 rounded-b-[2rem]">
        
        <div className="relative z-10 flex items-center justify-between mb-4">
          <Link to="/buildings">
            <Button variant="ghost" size="icon" className="rounded-full text-primary-foreground hover:bg-card/15">
              <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
            </Button>
          </Link>
          <Button variant="ghost" size="icon" className="rounded-full text-primary-foreground hover:bg-burgundy/30" onClick={() => setDelOpen(true)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative z-10">
          <p className="text-xs uppercase tracking-wider opacity-75">{t2(building.type as any)}</p>
          <h1 className="text-3xl font-black mt-1">{building.name}</h1>
          {building.name_en && <p className="text-sm opacity-80">{building.name_en}</p>}
          {building.city && <p className="text-xs opacity-70 mt-1">📍 {building.city}{building.address ? ` · ${building.address}` : ""}</p>}
        </div>
      </div>

      <div className="px-5 -mt-4 relative z-10">
        {/* Stats card */}
        <div className="bg-card rounded-2xl shadow-elev p-3 grid grid-cols-2 gap-2 mb-5 animate-float-up">
          <Stat label={t2("occupancy")} value={`${occupancy}%`} />
          <Stat label={t2("vacancy")} value={`${vacancy}%`} />
          <Stat label={t2("expected_month")} value={format(monthRents)} small />
          <Stat label={t2("collected_total")} value={format(collectedMonth)} small />
        </div>

        {/* Expenses link */}
        <Link to={`/buildings/${building.id}/expenses`}
          className="flex items-center justify-between bg-card rounded-2xl p-3.5 mb-4 border border-sage-200/40 shadow-soft">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-burgundy/10 text-burgundy flex items-center justify-center">
              <Wallet className="h-4 w-4" />
            </div>
            <span className="font-bold text-sage-600 text-sm">المصروفات / Expenses</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-black text-burgundy text-sm">{format(totalExpenses)}</span>
            <span className="text-sage-400 rtl:rotate-180">›</span>
          </div>
        </Link>


        {/* Search + Sort */}
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-sage-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={lang === "ar" ? "ابحث باسم المستأجر أو رقم الشقة" : "Search tenant or unit"}
              className="ps-10 rounded-xl border-sage-200 bg-card h-10"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-10 rounded-xl border border-sage-200 bg-card text-xs font-semibold text-sage-600 px-2"
          >
            <option value="smart">{lang === "ar" ? "الافتراضي" : "Default"}</option>
            <option value="number">{lang === "ar" ? "رقم الشقة ↑" : "Unit # ↑"}</option>
            <option value="name">{lang === "ar" ? "اسم المستأجر" : "Tenant name"}</option>
            <option value="due">{lang === "ar" ? "الأقرب استحقاقاً" : "Nearest due"}</option>
            <option value="vacant">{lang === "ar" ? "الشاغرة أولاً" : "Vacant first"}</option>
          </select>
        </div>

        {/* Filter chips */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
            {UNIT_FILTERS.map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold ${
                  filter === f ? "bg-gradient-sage text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground"
                }`}>{t2(f as any)}</button>
            ))}
          </div>
          <Button onClick={() => setAddOpen(true)} size="sm" className="rounded-full bg-gradient-sage text-primary-foreground h-9 px-3.5 ms-2 flex-shrink-0">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Units list */}
        <div className="space-y-2">
          {visible.length === 0 ? (
            <div className="bg-card border border-sage-200/60 rounded-3xl p-8 text-center shadow-soft">
              <div className="inline-flex p-3 rounded-2xl bg-sage-100 mb-3">
                <Home className="h-7 w-7 text-sage-400" />
              </div>
              <h3 className="font-bold text-sage-600 mb-1">{t2("no_units")}</h3>
              <p className="text-sm text-muted-foreground mb-4">{t2("no_units_msg")}</p>
              <Button onClick={() => setAddOpen(true)} className="bg-gradient-sage text-primary-foreground rounded-xl h-11 px-5 font-semibold">
                <Plus className="h-4 w-4 me-1.5" /> {t2("add_unit")}
              </Button>
            </div>
          ) : (
            visible.map((u, i) => {
              return (
              <div key={u.id} className="relative animate-float-up" style={{ animationDelay: `${i * 0.03}s` }}>
                <Link to={`/units/${u.id}`} className="block">
                  <div className="bg-card border border-sage-200/40 rounded-2xl p-4 flex items-center gap-3 shadow-soft hover:shadow-elev transition-all">
                    <div className="h-12 w-12 rounded-xl bg-gradient-sage text-primary-foreground flex flex-col items-center justify-center font-black flex-shrink-0">
                      <span className="text-[10px] opacity-80">F{u.floor}</span>
                      <span className="text-sm leading-none">{u.unit_number}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sage-600 truncate">{u.tenant_name || `${t2(u.type as any)} ${u.unit_number}`}</p>
                      <p className="text-xs text-muted-foreground">{u.status === "vacant" ? t2(u.type as any) : `${t2(u.type as any)} · ${format(Number(u.rent_amount))}/${t2(u.rent_type as any)}`}</p>
                      {u.status !== "vacant" && (
                        <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${u.rent_timing === "arrears" ? "bg-terracotta/15 text-terracotta" : "bg-sage-200/60 text-sage-600"}`}>
                          {t2(u.rent_timing === "arrears" ? "rent_timing_arrears" : "rent_timing_advance")}
                        </span>
                      )}
                      {u.tenant_name && (
                        <div className="mt-0.5">
                          <ArrearsBadge unit={u as any} payments={payments} />
                        </div>
                      )}
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${STATUS_STYLES[u.status] || ""}`}>{t2(u.status as any)}</span>
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditUnit(u); }}
                  aria-label={t2("edit_unit")}
                  className="absolute top-2 end-2 h-8 w-8 rounded-full bg-card/90 backdrop-blur border border-sage-200/60 flex items-center justify-center text-sage-500 hover:text-sage-600 hover:bg-card shadow-soft"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
              );
            })
          )}
        </div>
      </div>

      <ConfirmDeleteDialog open={delOpen} onOpenChange={setDelOpen} onConfirm={handleDelete} description={t2("delete_building_msg")} />
      <AddUnitDialog open={addOpen} onOpenChange={setAddOpen} buildingId={building.id} floors={building.floors} onCreated={load} />
      <EditUnitDialog open={!!editUnit} onOpenChange={(o) => !o && setEditUnit(null)} unit={editUnit} floors={building.floors} onSaved={load} />
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: any; small?: boolean }) {
  return (
    <div className="text-center">
      <p className={`font-black text-sage-600 ${small ? "text-sm" : "text-xl"}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{label}</p>
    </div>
  );
}
