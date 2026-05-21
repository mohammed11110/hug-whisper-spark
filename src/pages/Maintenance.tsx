import { useEffect, useState } from "react";
import { Plus, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useT2 } from "@/lib/i18n2";
import { useCurrency } from "@/lib/currency";
import { AddMaintenanceDialog } from "@/components/AddMaintenanceDialog";
import { toast } from "sonner";

interface Req {
  id: string; building_id: string; unit_id: string | null;
  title: string; description: string | null;
  priority: string; status: string;
  tenant_name: string | null; cost: number | null; vendor: string | null;
  photos: string[] | null;
  created_at: string;
  building_name?: string; unit_number?: string;
}

const PRIORITY_COLOR: Record<string, string> = {
  low: "bg-sage-200/40 text-sage-600",
  normal: "bg-slate-200/40 text-slate-600",
  high: "bg-terracotta/15 text-terracotta",
  urgent: "bg-burgundy/15 text-burgundy",
};

const STATUS_COLOR: Record<string, string> = {
  open: "bg-terracotta/15 text-terracotta",
  in_progress: "bg-slate-200/50 text-slate-700",
  done: "bg-sage-300/30 text-sage-600",
  cancelled: "bg-muted text-muted-foreground",
};

const STATUSES = ["open", "in_progress", "done", "cancelled"] as const;

export default function Maintenance() {
  const { lang } = useI18n();
  const t2 = useT2();
  const { format } = useCurrency();
  const [rows, setRows] = useState<Req[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data, error } = await (supabase as any)
      .from("maintenance_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    const list = (data || []) as Req[];
    const bIds = Array.from(new Set(list.map((r) => r.building_id)));
    const uIds = Array.from(new Set(list.map((r) => r.unit_id).filter(Boolean) as string[]));
    const [bs, us] = await Promise.all([
      bIds.length ? supabase.from("buildings").select("id,name,name_en").in("id", bIds) : Promise.resolve({ data: [] as any[] }),
      uIds.length ? supabase.from("units").select("id,unit_number").in("id", uIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const bMap = new Map((bs.data || []).map((b: any) => [b.id, b.name || b.name_en]));
    const uMap = new Map((us.data || []).map((u: any) => [u.id, u.unit_number]));
    setRows(list.map((r) => ({
      ...r,
      building_name: bMap.get(r.building_id) as string,
      unit_number: r.unit_id ? uMap.get(r.unit_id) as string : undefined,
    })));
  };
  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: string) => {
    const patch: any = { status };
    if (status === "done") patch.resolved_at = new Date().toISOString();
    const row = rows.find((r) => r.id === id);
    const { error } = await (supabase as any).from("maintenance_requests").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    if (status === "done") {
      if (row?.cost && Number(row.cost) > 0) {
        toast.success(lang === "ar" ? "✓ تم الإكمال وإضافة المصروف" : "✓ Completed & expense logged");
      } else {
        toast.success(lang === "ar" ? "✓ تم الإكمال — أضف تكلفة لتسجيلها كمصروف" : "✓ Completed — add a cost to log it as an expense");
      }
    } else {
      toast.success("✓");
    }
    load();
  };

  const filtered = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  return (
    <div className="mobile-shell min-h-screen pb-24 bg-background">
      <TopBar />
      <div className="px-5 pt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-sage-600" />
          <h1 className="text-2xl font-black text-sage-600">{t2("maintenance_requests")}</h1>
        </div>
        <Button onClick={() => setOpen(true)} size="sm" className="rounded-xl bg-gradient-sage text-primary-foreground">
          <Plus className="h-4 w-4 me-1" />{t2("new_request")}
        </Button>
      </div>

      <div className="px-5 mt-4 flex gap-1.5 overflow-x-auto scrollbar-none">
        {(["all", ...STATUSES] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              filter === s ? "bg-gradient-sage text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>
            {s === "all" ? t2("all") : t2(`status_${s}` as any)}
          </button>
        ))}
      </div>

      <div className="px-5 mt-4 space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-sage-300/60 bg-card px-6 py-12 text-center space-y-2">
            <div className="text-4xl">🛠️</div>
            <h3 className="text-base font-black text-sage-600">{t2("no_maintenance")}</h3>
            <p className="text-xs text-muted-foreground">{t2("no_maintenance_msg")}</p>
          </div>
        ) : filtered.map((r) => (
          <div key={r.id} className="rounded-2xl bg-card border border-sage-200/50 shadow-soft p-4 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sage-600 text-sm">{r.title}</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {r.building_name || "—"}{r.unit_number ? ` · #${r.unit_number}` : ""} · {new Date(r.created_at).toLocaleDateString(lang === "ar" ? "ar" : "en")}
                </p>
              </div>
              <div className="flex flex-col gap-1 items-end">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PRIORITY_COLOR[r.priority]}`}>{t2(`priority_${r.priority}` as any)}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[r.status]}`}>{t2(`status_${r.status}` as any)}</span>
              </div>
            </div>
            {r.description && <p className="text-xs text-muted-foreground leading-relaxed">{r.description}</p>}
            {(r.cost || r.vendor) && (
              <div className="flex justify-between text-[11px] text-sage-600 bg-sage-100/40 rounded-lg px-3 py-1.5">
                {r.vendor && <span>{t2("vendor")}: <b>{r.vendor}</b></span>}
                {r.cost ? <span>{t2("cost")}: <b>{format(Number(r.cost))}</b></span> : null}
              </div>
            )}
            {r.photos && r.photos.length > 0 && (
              <div className="grid grid-cols-4 gap-1.5">
                {r.photos.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="aspect-square rounded-lg overflow-hidden border border-sage-200 block">
                    <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            )}
            <div className="flex gap-1.5">
              {STATUSES.filter((s) => s !== r.status).map((s) => (
                <button key={s} onClick={() => setStatus(r.id, s)}
                  className="flex-1 text-[10px] font-bold py-1.5 rounded-lg border border-sage-200 text-sage-600 hover:bg-sage-100/40">
                  → {t2(`status_${s}` as any)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <AddMaintenanceDialog open={open} onOpenChange={setOpen} onCreated={load} />
      <BottomNav />
    </div>
  );
}
