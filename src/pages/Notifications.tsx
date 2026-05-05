import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, AlertTriangle, Calendar, Clock, MessageCircle, Phone } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { useAuth } from "@/lib/auth";
import { useAppSettings } from "@/lib/appSettings";
import { supabase } from "@/integrations/supabase/client";
import { openWhatsApp, fillTemplate } from "@/lib/whatsapp";

interface AlertItem {
  kind: "late" | "upcoming" | "contract";
  unit_id: string;
  unit_number: string;
  building_name: string;
  tenant_name: string;
  tenant_phone: string | null;
  amount: number;
  due_in_days?: number;
  contract_end?: string;
}

export default function Notifications() {
  const { t, lang } = useI18n();
  const { format } = useCurrency();
  const { user } = useAuth();
  const { settings } = useAppSettings();
  const [items, setItems] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "late" | "upcoming" | "contract">("all");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: bs } = await supabase.from("buildings").select("id, name, name_en").eq("user_id", user.id);
      const ids = (bs || []).map((b: any) => b.id);
      if (!ids.length) { setItems([]); setLoading(false); return; }
      const bMap = new Map((bs || []).map((b: any) => [b.id, b.name || b.name_en || "—"]));
      const { data: us } = await supabase.from("units")
        .select("id, unit_number, building_id, tenant_name, tenant_phone, rent_amount, status, due_day, contract_end_date")
        .in("building_id", ids)
        .not("tenant_name", "is", null);

      const today = new Date();
      const out: AlertItem[] = [];
      (us || []).forEach((u: any) => {
        const base = {
          unit_id: u.id,
          unit_number: u.unit_number,
          building_name: bMap.get(u.building_id) as string,
          tenant_name: u.tenant_name,
          tenant_phone: u.tenant_phone,
          amount: Number(u.rent_amount),
        };
        if (u.status === "late") out.push({ ...base, kind: "late" });
        // upcoming: due_day within next N days
        const due = new Date(today.getFullYear(), today.getMonth(), Math.min(u.due_day, 28));
        if (due < today) due.setMonth(due.getMonth() + 1);
        const days = Math.ceil((due.getTime() - today.getTime()) / 86400000);
        if (u.status !== "late" && days >= 0 && days <= settings.upcomingDays) {
          out.push({ ...base, kind: "upcoming", due_in_days: days });
        }
        // contract end approaching
        if (u.contract_end_date) {
          const ce = new Date(u.contract_end_date);
          const cd = Math.ceil((ce.getTime() - today.getTime()) / 86400000);
          if (cd >= 0 && cd <= settings.contractWarnDays) {
            out.push({ ...base, kind: "contract", contract_end: u.contract_end_date, due_in_days: cd });
          }
        }
      });
      out.sort((a, b) => (a.kind === "late" ? -1 : 1) - (b.kind === "late" ? -1 : 1));
      setItems(out);
      setLoading(false);
    })();
  }, [user, settings.upcomingDays, settings.contractWarnDays]);

  const filtered = useMemo(() => tab === "all" ? items : items.filter(i => i.kind === tab), [items, tab]);
  const counts = useMemo(() => ({
    late: items.filter(i => i.kind === "late").length,
    upcoming: items.filter(i => i.kind === "upcoming").length,
    contract: items.filter(i => i.kind === "contract").length,
  }), [items]);

  const sendWhatsApp = (it: AlertItem) => {
    if (!it.tenant_phone) return;
    const tpl = it.kind === "late" ? settings.templates.late : settings.templates.reminder;
    const msg = fillTemplate(tpl, {
      tenant: it.tenant_name,
      unit: it.unit_number,
      building: it.building_name,
      amount: format(it.amount),
    });
    openWhatsApp(it.tenant_phone, msg);
  };

  const TABS = [
    { id: "all", label: lang === "ar" ? "الكل" : "All", count: items.length, icon: Bell },
    { id: "late", label: lang === "ar" ? "متأخر" : "Late", count: counts.late, icon: AlertTriangle },
    { id: "upcoming", label: lang === "ar" ? "قادم" : "Upcoming", count: counts.upcoming, icon: Clock },
    { id: "contract", label: lang === "ar" ? "عقود" : "Contracts", count: counts.contract, icon: Calendar },
  ] as const;

  return (
    <div className="mobile-shell pb-24">
      <TopBar />
      <div className="px-5 pt-4">
        <h1 className="text-2xl font-black text-sage-600 tracking-tight flex items-center gap-2">
          <Bell className="h-6 w-6" />
          {lang === "ar" ? "التنبيهات" : "Notifications"}
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {items.length} {lang === "ar" ? "تنبيه نشط" : "active alerts"}
        </p>
      </div>

      <div className="px-5 mt-4 flex gap-1.5 overflow-x-auto">
        {TABS.map((tb) => (
          <button key={tb.id} onClick={() => setTab(tb.id as any)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${
              tab === tb.id ? "bg-gradient-sage text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground"
            }`}>
            <tb.icon className="h-3.5 w-3.5" />
            {tb.label}
            <span className={`text-[10px] px-1.5 rounded-full ${tab === tb.id ? "bg-white/25" : "bg-sage-200/60"}`}>{tb.count}</span>
          </button>
        ))}
      </div>

      <div className="px-5 mt-4 space-y-2.5">
        {loading ? (
          <p className="text-center text-sage-500 py-12 text-sm">{t("loading")}</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex p-4 rounded-3xl bg-sage-100 mb-3">
              <Bell className="h-8 w-8 text-sage-400" />
            </div>
            <p className="font-bold text-sage-600">{lang === "ar" ? "لا توجد تنبيهات" : "No alerts"}</p>
            <p className="text-xs text-muted-foreground mt-1">{lang === "ar" ? "كل شيء على ما يرام ✓" : "All clear ✓"}</p>
          </div>
        ) : filtered.map((it, i) => (
          <div key={`${it.kind}-${it.unit_id}-${i}`}
            className="bg-card border border-sage-200/40 rounded-2xl p-4 shadow-soft animate-float-up"
            style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}>
            <div className="flex items-start gap-3">
              <KindIcon kind={it.kind} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <Link to={`/units/${it.unit_id}`} className="font-bold text-sage-600 truncate hover:underline">
                    {it.tenant_name}
                  </Link>
                  <KindBadge kind={it.kind} days={it.due_in_days} lang={lang} />
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {it.building_name} · {it.unit_number}
                </p>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-sage-500">
                  <span>{format(it.amount)}</span>
                  {it.contract_end && <span>{lang === "ar" ? "ينتهي" : "ends"}: {it.contract_end}</span>}
                </div>
                {it.tenant_phone && (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => sendWhatsApp(it)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#25D366]/15 text-[#128C7E] text-xs font-bold hover:bg-[#25D366]/25">
                      <MessageCircle className="h-3.5 w-3.5" />
                      {lang === "ar" ? "واتساب" : "WhatsApp"}
                    </button>
                    <a href={`tel:${it.tenant_phone}`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-sage-100 text-sage-600 text-xs font-bold hover:bg-sage-200">
                      <Phone className="h-3.5 w-3.5" />
                      {lang === "ar" ? "اتصال" : "Call"}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <BottomNav />
    </div>
  );
}

function KindIcon({ kind }: { kind: AlertItem["kind"] }) {
  const map = {
    late: { bg: "bg-burgundy/15 text-burgundy", Icon: AlertTriangle },
    upcoming: { bg: "bg-terracotta/15 text-terracotta", Icon: Clock },
    contract: { bg: "bg-sage-300/30 text-sage-600", Icon: Calendar },
  } as const;
  const { bg, Icon } = map[kind];
  return (
    <div className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
      <Icon className="h-5 w-5" />
    </div>
  );
}

function KindBadge({ kind, days, lang }: { kind: AlertItem["kind"]; days?: number; lang: string }) {
  const isAr = lang === "ar";
  const label =
    kind === "late" ? (isAr ? "متأخر" : "Late") :
    kind === "upcoming" ? (isAr ? `خلال ${days}ي` : `In ${days}d`) :
    (isAr ? `عقد ${days}ي` : `Ends ${days}d`);
  const cls =
    kind === "late" ? "bg-burgundy/15 text-burgundy" :
    kind === "upcoming" ? "bg-terracotta/15 text-terracotta" :
    "bg-sage-300/30 text-sage-600";
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}>{label}</span>;
}
