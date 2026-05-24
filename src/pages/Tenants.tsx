import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Phone, Users, ChevronLeft, MessageCircle, CheckCircle2, AlertTriangle, Clock, TrendingDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { useI18n } from "@/lib/i18n";
import { useT2 } from "@/lib/i18n2";
import { useCurrency } from "@/lib/currency";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useAppSettings } from "@/lib/appSettings";
import { openWhatsApp, fillTemplate } from "@/lib/whatsapp";
import { computeBalance, type PaymentForBalance } from "@/lib/balance";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface TenantRow {
  unit_id: string;
  unit_number: string;
  building_id: string;
  building_name: string;
  tenant_name: string;
  tenant_phone: string | null;
  rent_amount: number;
  status: string;
  last_paid_date: string | null;
  last_payment_amount: number | null;
  contract_end_date: string | null;
  total_paid: number;
  outstanding: number;
}

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-sage-300/30 text-sage-600",
  late: "bg-burgundy/15 text-burgundy",
  soon: "bg-terracotta/15 text-terracotta",
};

export default function Tenants() {
  const { t, lang } = useI18n();
  const t2 = useT2();
  const { format } = useCurrency();
  const { user } = useAuth();
  const { settings } = useAppSettings();
  const [rows, setRows] = useState<TenantRow[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "overdue" | "expiring" | "no_phone">("all");
  const [sortBy, setSortBy] = useState<"name" | "debt_desc" | "building_unit">(() => {
    try { return (localStorage.getItem("amlaki.tenants.sortBy") as any) || "name"; } catch { return "name"; }
  });
  useEffect(() => { try { localStorage.setItem("amlaki.tenants.sortBy", sortBy); } catch {} }, [sortBy]);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState<string | null>(null);

  const quickCollect = async (r: TenantRow) => {
    const priorArrears = Math.max(0, r.outstanding - r.rent_amount);
    let collectArrears = false;
    if (priorArrears > 0.009) {
      const msg = lang === "ar"
        ? `يوجد متأخرات سابقة بقيمة ${format(priorArrears)}.\n\nاضغط "موافق" لتحصيل الإيجار + المتأخرات (${format(r.rent_amount + priorArrears)})\nاضغط "إلغاء" لتحصيل إيجار الشهر فقط (${format(r.rent_amount)})`
        : `Prior arrears: ${format(priorArrears)}.\n\nOK = Collect rent + arrears (${format(r.rent_amount + priorArrears)})\nCancel = Collect this month only (${format(r.rent_amount)})`;
      collectArrears = window.confirm(msg);
    }
    setCollecting(r.unit_id);
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const lastDay = new Date(y, m + 1, 0).getDate();
    const start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const end = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const today_iso = today.toISOString().slice(0, 10);
    const receiptNo = `R-${Date.now()}`;
    const rows: any[] = [{
      unit_id: r.unit_id,
      amount: r.rent_amount,
      expected_amount: r.rent_amount,
      payment_date: today_iso,
      receipt_number: receiptNo,
      payment_method: "cash",
      period_start: start,
      period_end: end,
    }];
    if (collectArrears && priorArrears > 0.009) {
      rows.push({
        unit_id: r.unit_id,
        amount: priorArrears,
        expected_amount: null,
        payment_date: today_iso,
        receipt_number: receiptNo,
        payment_method: "cash",
        notes: lang === "ar" ? "تحصيل متأخرات سابقة" : "Prior arrears collection",
        period_start: null,
        period_end: null,
      });
    }
    const { error } = await supabase.from("payments").insert(rows);
    if (!error) {
      const collected = r.rent_amount + (collectArrears ? priorArrears : 0);
      await supabase.from("units").update({ last_paid_date: today_iso, status: "paid" }).eq("id", r.unit_id);
      setRows((prev) => prev.map((x) => x.unit_id === r.unit_id
        ? { ...x, status: "paid", last_paid_date: today_iso, total_paid: x.total_paid + collected, outstanding: Math.max(0, x.outstanding - collected) }
        : x));
      toast.success(lang === "ar" ? "تم تسجيل الدفعة ✓" : "Payment recorded ✓");
    } else {
      toast.error(error.message);
    }
    setCollecting(null);
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: bs } = await supabase.from("buildings").select("id, name, name_en").eq("user_id", user.id);
      const ids = (bs || []).map((b: any) => b.id);
      if (!ids.length) { setRows([]); setLoading(false); return; }
      const bMap = new Map((bs || []).map((b: any) => [b.id, b.name || b.name_en || "—"]));
      const { data: us } = await supabase.from("units")
        .select("id, unit_number, building_id, tenant_name, tenant_phone, rent_amount, rent_type, status, last_paid_date, contract_end_date, contract_start_date, opening_balance, opening_balance_date")
        .in("building_id", ids)
        .not("tenant_name", "is", null);
      const unitIds = (us || []).map((u: any) => u.id);
      const { data: ps } = unitIds.length
        ? await supabase.from("payments").select("unit_id, amount, payment_date, deleted_at").in("unit_id", unitIds).is("deleted_at", null)
        : { data: [] as any[] };
      const totals = new Map<string, number>();
      const lastPay = new Map<string, { date: string; amount: number }>();
      (ps || []).forEach((p: any) => {
        totals.set(p.unit_id, (totals.get(p.unit_id) || 0) + Number(p.amount));
        const cur = lastPay.get(p.unit_id);
        if (!cur || (p.payment_date && p.payment_date > cur.date)) {
          lastPay.set(p.unit_id, { date: p.payment_date, amount: Number(p.amount) });
        }
      });
      const mapped: TenantRow[] = (us || []).map((u: any) => {
        const bal = computeBalance(u as any, (ps || []) as PaymentForBalance[]);
        const lp = lastPay.get(u.id);
        return {
          unit_id: u.id,
          unit_number: u.unit_number,
          building_id: u.building_id,
          building_name: bMap.get(u.building_id) as string,
          tenant_name: u.tenant_name,
          tenant_phone: u.tenant_phone,
          rent_amount: Number(u.rent_amount),
          status: u.status,
          last_paid_date: lp?.date || u.last_paid_date,
          last_payment_amount: lp?.amount ?? null,
          contract_end_date: u.contract_end_date,
          total_paid: totals.get(u.id) || 0,
          outstanding: bal.outstanding,
        };
      });
      setRows(mapped);
      setLoading(false);
    })();
  }, [user]);

  const numOf = (s: string) => { const m = String(s || "").match(/\d+/); return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER; };
  const daysUntil = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso).getTime();
    if (isNaN(d)) return null;
    return Math.ceil((d - Date.now()) / 86400000);
  };

  const kpis = useMemo(() => {
    const overdue = rows.filter((r) => r.outstanding > 0.009);
    const totalDebt = overdue.reduce((s, r) => s + r.outstanding, 0);
    const expiring = rows.filter((r) => {
      const d = daysUntil(r.contract_end_date);
      return d !== null && d >= 0 && d <= 30;
    }).length;
    return { total: rows.length, overdue: overdue.length, totalDebt, expiring };
  }, [rows]);

  const attention = useMemo(() =>
    [...rows]
      .filter((r) => r.outstanding > 0.009)
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 3),
  [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let base = !q ? rows : rows.filter((r) =>
      r.tenant_name.toLowerCase().includes(q) ||
      r.tenant_phone?.toLowerCase().includes(q) ||
      r.building_name.toLowerCase().includes(q) ||
      r.unit_number.toLowerCase().includes(q)
    );
    if (filter === "overdue") base = base.filter((r) => r.outstanding > 0.009);
    else if (filter === "expiring") base = base.filter((r) => {
      const d = daysUntil(r.contract_end_date);
      return d !== null && d >= 0 && d <= 30;
    });
    else if (filter === "no_phone") base = base.filter((r) => !r.tenant_phone);
    const sorted = [...base];
    if (sortBy === "debt_desc") {
      sorted.sort((a, b) => b.outstanding - a.outstanding || a.tenant_name.localeCompare(b.tenant_name));
    } else if (sortBy === "building_unit") {
      sorted.sort((a, b) =>
        a.building_name.localeCompare(b.building_name) ||
        numOf(a.unit_number) - numOf(b.unit_number) ||
        a.unit_number.localeCompare(b.unit_number)
      );
    } else {
      sorted.sort((a, b) => a.tenant_name.localeCompare(b.tenant_name));
    }
    return sorted;
  }, [rows, search, sortBy, filter]);

  return (
    <div className="mobile-shell pb-24">
      <TopBar />
      <div className="px-5 md:px-8 lg:px-12 pt-4">
        <h1 className="text-2xl font-black text-sage-600 tracking-tight">{t("tenants")}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">{filtered.length} {t("tenants")}</p>
      </div>

      {/* KPI bar */}
      <div className="px-5 md:px-8 lg:px-12 mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: lang === "ar" ? "إجمالي المستأجرين" : "Total tenants", value: String(kpis.total), tone: "sage" as const, icon: Users },
          { label: lang === "ar" ? "متأخرون" : "Overdue", value: String(kpis.overdue), tone: "burgundy" as const, icon: AlertTriangle },
          { label: lang === "ar" ? "إجمالي الديون" : "Total debt", value: format(kpis.totalDebt), tone: "terracotta" as const, icon: TrendingDown },
          { label: lang === "ar" ? "عقود تنتهي ≤ 30 يوم" : "Expiring ≤ 30d", value: String(kpis.expiring), tone: "gold" as const, icon: Clock },
        ].map((k) => {
          const toneCls = k.tone === "burgundy" ? "text-burgundy bg-burgundy/10"
            : k.tone === "terracotta" ? "text-terracotta bg-terracotta/10"
            : k.tone === "gold" ? "text-[hsl(var(--gold))] bg-[hsl(var(--gold))]/10"
            : "text-sage-600 bg-sage-100";
          return (
            <div key={k.label} className="bg-card border border-sage-200/40 rounded-2xl p-3 shadow-soft">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-sage-500 uppercase tracking-wide truncate">{k.label}</p>
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-lg ${toneCls}`}>
                  <k.icon className="h-3 w-3" />
                </span>
              </div>
              <p className="mt-1 text-lg font-black text-sage-600 truncate">{k.value}</p>
            </div>
          );
        })}
      </div>

      {/* Smart "needs attention" row */}
      {attention.length > 0 && (
        <div className="px-5 md:px-8 lg:px-12 mt-4">
          <div className="bg-gradient-to-br from-burgundy/8 to-terracotta/8 border border-burgundy/20 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-burgundy" />
              <p className="text-xs font-black text-burgundy">{lang === "ar" ? "يستحق الانتباه" : "Needs attention"}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {attention.map((r) => (
                <Link key={r.unit_id} to={`/units/${r.unit_id}`} className="bg-card/70 rounded-xl px-3 py-2 flex items-center justify-between gap-2 hover:bg-card transition-colors">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-sage-600 truncate">{r.tenant_name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{r.building_name} · {r.unit_number}</p>
                  </div>
                  <span className="text-xs font-black text-burgundy flex-shrink-0">{format(r.outstanding)}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="px-5 md:px-8 lg:px-12 mt-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-sage-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search")}
            className="ps-10 rounded-xl border-sage-200 bg-card h-11" />
        </div>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
          <SelectTrigger className="w-[140px] rounded-xl border-sage-200 bg-card h-11 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">{lang === "ar" ? "الاسم" : "Name"}</SelectItem>
            <SelectItem value="debt_desc">{lang === "ar" ? "الأكثر ديوناً" : "Most debt"}</SelectItem>
            <SelectItem value="building_unit">{lang === "ar" ? "المبنى/الوحدة" : "Building/Unit"}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Quick filter chips */}
      <div className="px-5 md:px-8 lg:px-12 mt-3 flex gap-1.5 overflow-x-auto no-scrollbar">
        {([
          { key: "all", label: lang === "ar" ? "الكل" : "All", count: rows.length },
          { key: "overdue", label: lang === "ar" ? "متأخرون" : "Overdue", count: kpis.overdue },
          { key: "expiring", label: lang === "ar" ? "ينتهي قريباً" : "Expiring", count: kpis.expiring },
          { key: "no_phone", label: lang === "ar" ? "بدون هاتف" : "No phone", count: rows.filter((r) => !r.tenant_phone).length },
        ] as const).map((c) => {
          const active = filter === c.key;
          return (
            <button key={c.key} onClick={() => setFilter(c.key as any)}
              className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
                active ? "bg-sage-500 text-primary-foreground border-sage-500" : "bg-card text-sage-600 border-sage-200 hover:border-sage-300"
              }`}>
              <span>{c.label}</span>
              <span className={`text-[10px] px-1.5 rounded-full ${active ? "bg-primary-foreground/20" : "bg-sage-100"}`}>{c.count}</span>
            </button>
          );
        })}
      </div>


      <div className="px-5 md:px-8 lg:px-12 mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 md:gap-4">
        {loading ? (
          <p className="text-center text-sage-500 py-12 text-sm">{t("loading")}</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex p-4 rounded-3xl bg-sage-100 mb-3">
              <Users className="h-8 w-8 text-sage-400" />
            </div>
            <p className="font-bold text-sage-600">{t2("no_tenants")}</p>
          </div>
        ) : (
          filtered.map((r, i) => (
            <Link key={r.unit_id} to={`/units/${r.unit_id}`}
              className="block bg-card border border-sage-200/40 rounded-2xl p-4 shadow-soft animate-float-up"
              style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}>
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-xl bg-gradient-sage text-primary-foreground flex items-center justify-center font-black flex-shrink-0">
                  {r.tenant_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`h-2 w-2 rounded-full flex-shrink-0 ${
                        r.outstanding > 0.009 ? "bg-burgundy" : r.status === "paid" ? "bg-sage-500" : "bg-terracotta"
                      }`} />
                      <p className="font-bold text-sage-600 truncate">{r.tenant_name}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${STATUS_STYLES[r.status] || "bg-muted text-muted-foreground"}`}>{t2(r.status as any)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {r.building_name} · {t2("unit_number")} {r.unit_number}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-sage-500">
                    {r.tenant_phone && (
                      <a href={`tel:${r.tenant_phone}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 hover:text-sage-600">
                        <Phone className="h-3 w-3" />{r.tenant_phone}
                      </a>
                    )}
                    <span>{format(r.rent_amount)}/{lang === "ar" ? "شهر" : "mo"}</span>
                    <span>{lang === "ar" ? "إجمالي مدفوع" : "Total paid"}: <b className="text-sage-600">{format(r.total_paid)}</b></span>
                    {r.last_paid_date && (
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-sage-500" />
                        {lang === "ar" ? "آخر دفعة" : "Last payment"}:&nbsp;
                        <b className="text-sage-600">
                          {r.last_payment_amount != null ? `${format(r.last_payment_amount)} · ` : ""}
                          {new Date(r.last_paid_date).toLocaleDateString(lang === "ar" ? "ar" : "en", { day: "numeric", month: "short", year: "numeric" })}
                        </b>
                      </span>
                    )}
                    {r.outstanding > 0 && (
                      <span className="text-burgundy font-bold">{lang === "ar" ? "الديون" : "Debt"}: {format(r.outstanding)}</span>
                    )}
                    {r.contract_end_date && (() => {
                      const d = daysUntil(r.contract_end_date);
                      if (d !== null && d >= 0 && d <= 30) {
                        return (
                          <span className="inline-flex items-center gap-1 text-[hsl(var(--gold))] font-bold bg-[hsl(var(--gold))]/10 px-1.5 py-0.5 rounded">
                            <Clock className="h-3 w-3" />
                            {lang === "ar" ? `ينتهي خلال ${d} يوم` : `Expires in ${d}d`}
                          </span>
                        );
                      }
                      return <span>{t2("contract_end")}: {r.contract_end_date}</span>;
                    })()}
                  </div>
                  {r.outstanding > 0.009 && (
                    <div className="mt-2 h-1.5 rounded-full bg-sage-100 overflow-hidden">
                      <div className="h-full bg-burgundy/70"
                        style={{ width: `${Math.min(100, (r.outstanding / Math.max(r.rent_amount, 1)) * 100)}%` }} />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {r.status !== "paid" && (
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); quickCollect(r); }}
                        disabled={collecting === r.unit_id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sage-500 text-primary-foreground text-[11px] font-bold hover:bg-sage-600 disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        {collecting === r.unit_id
                          ? (lang === "ar" ? "..." : "...")
                          : (lang === "ar" ? `تم استلام ${format(r.rent_amount)}` : `Collected ${format(r.rent_amount)}`)}
                      </button>
                    )}
                    {r.tenant_phone && (
                      <button onClick={(e) => {
                        e.preventDefault(); e.stopPropagation();
                        const tpl = r.status === "late" ? settings.templates.late : settings.templates.reminder;
                        openWhatsApp(r.tenant_phone!, fillTemplate(tpl, {
                          tenant: r.tenant_name, unit: r.unit_number, building: r.building_name, amount: format(r.rent_amount),
                        }));
                      }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366]/15 text-[#128C7E] text-[11px] font-bold hover:bg-[#25D366]/25">
                        <MessageCircle className="h-3 w-3" />
                        {lang === "ar" ? "إرسال تذكير" : "Send reminder"}
                      </button>
                    )}
                  </div>
                </div>
                <ChevronLeft className="h-4 w-4 text-sage-400 mt-1 rtl:rotate-180" />
              </div>
            </Link>
          ))
        )}
      </div>
      <BottomNav />
    </div>
  );
}
