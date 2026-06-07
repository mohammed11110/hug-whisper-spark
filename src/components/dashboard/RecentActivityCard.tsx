import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, Plus, Pencil, Trash2, Wallet, RotateCcw, CircleSlash } from "lucide-react";
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
}

const actionIcon: Record<string, any> = {
  created: Plus,
  updated: Pencil,
  deleted: Trash2,
  paid: Wallet,
  restored: RotateCcw,
  ended: CircleSlash,
};

const actionColor: Record<string, string> = {
  created: "bg-sage-100 text-sage-500",
  updated: "bg-muted text-foreground",
  deleted: "bg-burgundy/10 text-burgundy",
  paid: "bg-gold/15 text-gold",
  restored: "bg-sage-100 text-sage-400",
  ended: "bg-terracotta/15 text-terracotta",
};

export function RecentActivityCard({ limit = 8, hideWhenEmpty = false }: { limit?: number; hideWhenEmpty?: boolean }) {
  const { lang } = useI18n();
  const t2 = useT2();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("activity_log")
        .select("id, entity_type, entity_label, action, description_ar, description_en, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (!alive) return;
      setRows((data || []) as Row[]);
      setLoading(false);
    })();

    const channel = supabase
      .channel(`activity_log_dash:${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_log" }, (payload) => {
        setRows((prev) => [payload.new as Row, ...prev].slice(0, limit));
      })
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [limit]);

  return (
    <div className="bg-card rounded-3xl p-5 shadow-soft border border-sage-200/40 animate-float-up" style={{ animationDelay: "0.3s" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-sage-100 grid place-items-center">
            <Activity className="h-4 w-4 text-sage-500" />
          </div>
          <h3 className="font-bold text-sage-600 text-base">{t2("recent_activity")}</h3>
        </div>
        <Link to="/activity" className="text-xs text-sage-500 font-semibold hover:underline">
          {t2("view_all")} ›
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 bg-sage-100/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-sage-200 rounded-2xl">
          <p className="font-semibold text-sage-600 text-sm">{t2("no_activity")}</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed px-4">{t2("no_activity_msg")}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const Icon = actionIcon[r.action] || Activity;
            const color = actionColor[r.action] || "bg-sage-100 text-sage-500";
            const desc = (lang === "ar" ? r.description_ar : r.description_en) || r.entity_label || r.entity_type;
            return (
              <li key={r.id} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-sage-100/40 transition-colors">
                <div className={`h-9 w-9 rounded-lg grid place-items-center shrink-0 ${color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-sage-600 leading-snug truncate">{desc}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 font-mono tabular-nums">
                    {formatActivityTime(r.created_at, lang)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
