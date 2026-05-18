import { useEffect, useMemo, useState } from "react";
import { Activity as ActivityIcon, Plus, Pencil, Trash2, Wallet, RotateCcw, CircleSlash, Search } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useT2 } from "@/lib/i18n2";
import { formatActivityTime } from "@/lib/activityLogger";

interface Row {
  id: string;
  entity_type: string;
  entity_label: string | null;
  action: string;
  description_ar: string | null;
  description_en: string | null;
  created_at: string;
  building_id: string | null;
}

const actionIcon: Record<string, any> = {
  created: Plus, updated: Pencil, deleted: Trash2, paid: Wallet, restored: RotateCcw, ended: CircleSlash,
};
const actionColor: Record<string, string> = {
  created: "bg-sage-100 text-sage-500",
  updated: "bg-slate-100 text-slate-600",
  deleted: "bg-burgundy/10 text-burgundy",
  paid: "bg-gold/15 text-gold",
  restored: "bg-sage-100 text-sage-400",
  ended: "bg-terracotta/15 text-terracotta",
};

export default function Activity() {
  const { lang } = useI18n();
  const t2 = useT2();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [action, setAction] = useState<string>("all");
  const [entity, setEntity] = useState<string>("all");

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("activity_log")
        .select("id, entity_type, entity_label, action, description_ar, description_en, created_at, building_id")
        .order("created_at", { ascending: false })
        .limit(500);
      if (!alive) return;
      setRows((data || []) as Row[]);
      setLoading(false);
    })();

    const channel = supabase
      .channel("activity_log_page")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_log" }, (payload) => {
        setRows((prev) => [payload.new as Row, ...prev]);
      })
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (action !== "all" && r.action !== action) return false;
      if (entity !== "all" && r.entity_type !== entity) return false;
      if (!needle) return true;
      const blob = `${r.description_ar || ""} ${r.description_en || ""} ${r.entity_label || ""}`.toLowerCase();
      return blob.includes(needle);
    });
  }, [rows, q, action, entity]);

  return (
    <div className="mobile-shell pb-24">
      <TopBar />
      <div className="px-5 pt-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="h-11 w-11 rounded-2xl bg-gradient-sage grid place-items-center shadow-soft">
            <ActivityIcon className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-black text-sage-600 tracking-tight">{t2("activity_log")}</h1>
            <p className="text-xs text-muted-foreground">{t2("no_activity_msg")}</p>
          </div>
        </div>

        <div className="bg-card rounded-2xl p-3 shadow-soft border border-sage-200/40 space-y-2.5">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t2("search")} className="ps-10 h-11 rounded-xl border-sage-200/60" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="h-11 rounded-xl border-sage-200/60"><SelectValue placeholder={t2("filter_action")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t2("all")}</SelectItem>
                <SelectItem value="created">{t2("act_created")}</SelectItem>
                <SelectItem value="updated">{t2("act_updated")}</SelectItem>
                <SelectItem value="deleted">{t2("act_deleted")}</SelectItem>
                <SelectItem value="paid">{t2("act_paid")}</SelectItem>
                <SelectItem value="ended">{t2("act_ended")}</SelectItem>
                <SelectItem value="restored">{t2("act_restored")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={entity} onValueChange={setEntity}>
              <SelectTrigger className="h-11 rounded-xl border-sage-200/60"><SelectValue placeholder={t2("filter_entity")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t2("all")}</SelectItem>
                <SelectItem value="building">{t2("ent_building")}</SelectItem>
                <SelectItem value="unit">{t2("ent_unit")}</SelectItem>
                <SelectItem value="tenant">{t2("ent_tenant")}</SelectItem>
                <SelectItem value="payment">{t2("ent_payment")}</SelectItem>
                <SelectItem value="expense">{t2("ent_expense")}</SelectItem>
                <SelectItem value="maintenance">{t2("ent_maintenance")}</SelectItem>
                <SelectItem value="settings">{t2("ent_settings")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 bg-sage-100/50 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-sage-200 rounded-3xl bg-card">
            <p className="font-bold text-sage-600">{t2("no_activity")}</p>
            <p className="text-xs text-muted-foreground mt-1 px-6 leading-relaxed">{t2("no_activity_msg")}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((r) => {
              const Icon = actionIcon[r.action] || ActivityIcon;
              const color = actionColor[r.action] || "bg-sage-100 text-sage-500";
              const desc = (lang === "ar" ? r.description_ar : r.description_en) || r.entity_label || r.entity_type;
              return (
                <li key={r.id} className="bg-card rounded-2xl p-3 shadow-soft border border-sage-200/40 flex items-start gap-3">
                  <div className={`h-10 w-10 rounded-xl grid place-items-center shrink-0 ${color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-sage-400 bg-sage-100 px-1.5 py-0.5 rounded">
                        {t2(("ent_" + r.entity_type) as any)}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-sage-600 leading-snug break-words">{desc}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 font-mono tabular-nums">
                      {formatActivityTime(r.created_at, lang)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
