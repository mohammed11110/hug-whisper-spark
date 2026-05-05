import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Receipt, Printer, Trash2, Search, Calendar, Plus } from "lucide-react";
import { AddPaymentDialog } from "@/components/AddPaymentDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { useI18n } from "@/lib/i18n";
import { useT2 } from "@/lib/i18n2";
import { useCurrency } from "@/lib/currency";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Row {
  id: string;
  unit_id: string;
  amount: number;
  payment_date: string;
  receipt_number: string | null;
  unit_number: string;
  building_name: string;
  tenant_name: string | null;
}

type Filter = "all" | "month" | "year";

export default function Payments() {
  const { t } = useI18n();
  const t2 = useT2();
  const { format, currency } = useCurrency();
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("month");
  const [delId, setDelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: pays } = await supabase
      .from("payments")
      .select("id, unit_id, amount, payment_date, receipt_number")
      .order("payment_date", { ascending: false })
      .limit(500);
    const unitIds = Array.from(new Set((pays || []).map((p: any) => p.unit_id)));
    const { data: units } = unitIds.length
      ? await supabase.from("units").select("id, unit_number, tenant_name, building_id").in("id", unitIds)
      : { data: [] as any[] };
    const buildingIds = Array.from(new Set((units || []).map((u: any) => u.building_id)));
    const { data: builds } = buildingIds.length
      ? await supabase.from("buildings").select("id, name, name_en").in("id", buildingIds)
      : { data: [] as any[] };
    const uMap = new Map((units || []).map((u: any) => [u.id, u]));
    const bMap = new Map((builds || []).map((b: any) => [b.id, b]));
    const mapped: Row[] = (pays || []).map((p: any) => {
      const u = uMap.get(p.unit_id);
      const b = u ? bMap.get(u.building_id) : null;
      return {
        id: p.id,
        unit_id: p.unit_id,
        amount: Number(p.amount),
        payment_date: p.payment_date,
        receipt_number: p.receipt_number,
        unit_number: u?.unit_number ?? "—",
        tenant_name: u?.tenant_name ?? null,
        building_name: b?.name || b?.name_en || "—",
      };
    });
    setRows(mapped);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const now = new Date();
    return rows.filter((r) => {
      const d = new Date(r.payment_date);
      if (filter === "month" && (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear())) return false;
      if (filter === "year" && d.getFullYear() !== now.getFullYear()) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          r.receipt_number?.toLowerCase().includes(q) ||
          r.unit_number.toLowerCase().includes(q) ||
          r.building_name.toLowerCase().includes(q) ||
          r.tenant_name?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rows, search, filter]);

  const total = filtered.reduce((s, r) => s + r.amount, 0);

  const handleDelete = async () => {
    if (!delId) return;
    const { error } = await supabase.from("payments").delete().eq("id", delId);
    if (error) return toast.error(error.message);
    toast.success("✓");
    setDelId(null);
    load();
  };

  const printReceipt = (r: Row) => {
    const w = window.open("", "_blank", "width=600,height=800");
    if (!w) return;
    w.document.write(`
      <html><head><title>${r.receipt_number || r.id}</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:40px;color:#3a4f3a;background:#faf6ee}
        .card{border:2px solid #a3b89c;border-radius:24px;padding:32px;background:#fff}
        h1{margin:0 0 4px;font-size:28px;color:#5a7359}
        .muted{color:#7a8a78;font-size:13px}
        .row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px dashed #cdd9c8}
        .total{margin-top:16px;padding:16px;background:#eef3ea;border-radius:16px;display:flex;justify-content:space-between;font-weight:800;font-size:20px}
      </style></head><body>
        <div class="card">
          <h1>أملاكي · Amlaki</h1>
          <p class="muted">${t2("receipt_number")}: <b>${r.receipt_number || "—"}</b></p>
          <p class="muted">${t2("payment_date")}: <b>${r.payment_date}</b></p>
          <div class="row"><span>${t2("building_name")}</span><b>${r.building_name}</b></div>
          <div class="row"><span>${t2("unit_number")}</span><b>${r.unit_number}</b></div>
          <div class="row"><span>${t2("tenant_name")}</span><b>${r.tenant_name || "—"}</b></div>
          <div class="total"><span>${t2("total")}</span><span>${format(r.amount)}</span></div>
        </div>
      </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  return (
    <div className="mobile-shell min-h-screen pb-24 bg-background">
      <TopBar />

      <div className="px-5 pt-2">
        <h1 className="text-2xl font-black text-sage-600">{t2("payments")}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">{t2("receipts")}</p>
      </div>

      {/* Stat */}
      <div className="px-5 mt-4">
        <div className="rounded-3xl bg-gradient-deep text-primary-foreground p-5 shadow-soft">
          <p className="text-xs uppercase tracking-wider opacity-75">
            {filter === "month" ? t2("this_month") : filter === "year" ? t2("filter_year") : t2("all_payments")}
          </p>
          <p className="text-3xl font-black mt-1">{format(total)}</p>
          <p className="text-xs opacity-80 mt-1">{filtered.length} {t2("receipts")}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="px-5 mt-4 space-y-3">
        <div className="relative">
          <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-sage-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search" as any) || "..."}
            className="ps-10 rounded-xl border-sage-200 bg-card h-11" />
        </div>
        <div className="flex gap-1.5">
          {(["month", "year", "all"] as Filter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                filter === f ? "bg-gradient-sage text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground"
              }`}>
              {t2(f === "all" ? "filter_all" : f === "month" ? "filter_month" : "filter_year")}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="px-5 mt-4 space-y-2.5">
        {loading ? (
          <p className="text-center text-sage-500 py-12 text-sm">{t("loading")}</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex p-4 rounded-3xl bg-sage-100 mb-3">
              <Receipt className="h-8 w-8 text-sage-400" />
            </div>
            <p className="font-bold text-sage-600">{t2("no_payments_msg")}</p>
          </div>
        ) : (
          filtered.map((r, i) => (
            <div key={r.id}
              className="bg-card border border-sage-200/40 rounded-2xl p-4 shadow-soft animate-float-up"
              style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}>
              <div className="flex items-start gap-3">
                <Link to={`/units/${r.unit_id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sage-600 truncate">{r.building_name} · {r.unit_number}</span>
                  </div>
                  {r.tenant_name && <p className="text-xs text-muted-foreground truncate mt-0.5">{r.tenant_name}</p>}
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-sage-500">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{r.payment_date}</span>
                    {r.receipt_number && <span className="font-mono">{r.receipt_number}</span>}
                  </div>
                </Link>
                <div className="text-end">
                  <p className="font-black text-sage-600 text-lg whitespace-nowrap">{format(r.amount)}</p>
                  <div className="flex gap-1 mt-1 justify-end">
                    <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-sage-500" onClick={() => printReceipt(r)}>
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-burgundy hover:bg-burgundy/10" onClick={() => setDelId(r.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <BottomNav />
      <ConfirmDeleteDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)} onConfirm={handleDelete} />
    </div>
  );
}
