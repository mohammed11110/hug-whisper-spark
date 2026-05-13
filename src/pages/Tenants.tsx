import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Phone, Users, ChevronLeft, MessageCircle, CheckCircle2 } from "lucide-react";
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
  contract_end_date: string | null;
  total_paid: number;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: bs } = await supabase.from("buildings").select("id, name, name_en").eq("user_id", user.id);
      const ids = (bs || []).map((b: any) => b.id);
      if (!ids.length) { setRows([]); setLoading(false); return; }
      const bMap = new Map((bs || []).map((b: any) => [b.id, b.name || b.name_en || "—"]));
      const { data: us } = await supabase.from("units")
        .select("id, unit_number, building_id, tenant_name, tenant_phone, rent_amount, status, last_paid_date, contract_end_date")
        .in("building_id", ids)
        .not("tenant_name", "is", null);
      const unitIds = (us || []).map((u: any) => u.id);
      const { data: ps } = unitIds.length
        ? await supabase.from("payments").select("unit_id, amount").in("unit_id", unitIds)
        : { data: [] as any[] };
      const totals = new Map<string, number>();
      (ps || []).forEach((p: any) => totals.set(p.unit_id, (totals.get(p.unit_id) || 0) + Number(p.amount)));
      const mapped: TenantRow[] = (us || []).map((u: any) => ({
        unit_id: u.id,
        unit_number: u.unit_number,
        building_id: u.building_id,
        building_name: bMap.get(u.building_id) as string,
        tenant_name: u.tenant_name,
        tenant_phone: u.tenant_phone,
        rent_amount: Number(u.rent_amount),
        status: u.status,
        last_paid_date: u.last_paid_date,
        contract_end_date: u.contract_end_date,
        total_paid: totals.get(u.id) || 0,
      }));
      mapped.sort((a, b) => a.tenant_name.localeCompare(b.tenant_name));
      setRows(mapped);
      setLoading(false);
    })();
  }, [user]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.tenant_name.toLowerCase().includes(q) ||
      r.tenant_phone?.toLowerCase().includes(q) ||
      r.building_name.toLowerCase().includes(q) ||
      r.unit_number.toLowerCase().includes(q)
    );
  }, [rows, search]);

  return (
    <div className="mobile-shell pb-24">
      <TopBar />
      <div className="px-5 pt-4">
        <h1 className="text-2xl font-black text-sage-600 tracking-tight">{t("tenants")}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">{filtered.length} {t("tenants")}</p>
      </div>

      <div className="px-5 mt-4">
        <div className="relative">
          <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-sage-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search")}
            className="ps-10 rounded-xl border-sage-200 bg-card h-11" />
        </div>
      </div>

      <div className="px-5 mt-4 space-y-2.5">
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
                    <p className="font-bold text-sage-600 truncate">{r.tenant_name}</p>
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
                    {r.contract_end_date && (
                      <span>{t2("contract_end")}: {r.contract_end_date}</span>
                    )}
                  </div>
                  {r.tenant_phone && (
                    <button onClick={(e) => {
                      e.preventDefault(); e.stopPropagation();
                      const tpl = r.status === "late" ? settings.templates.late : settings.templates.reminder;
                      openWhatsApp(r.tenant_phone!, fillTemplate(tpl, {
                        tenant: r.tenant_name, unit: r.unit_number, building: r.building_name, amount: format(r.rent_amount),
                      }));
                    }}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366]/15 text-[#128C7E] text-[11px] font-bold hover:bg-[#25D366]/25">
                      <MessageCircle className="h-3 w-3" />
                      {lang === "ar" ? "إرسال تذكير" : "Send reminder"}
                    </button>
                  )}
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
