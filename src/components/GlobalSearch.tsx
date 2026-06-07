import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Building2, DoorOpen, User, Receipt, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

interface SearchItem {
  type: "building" | "unit" | "tenant" | "payment";
  id: string;
  title: string;
  subtitle: string;
  to: string;
}

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [q, setQ] = useState("");
  const [items, setItems] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) { setQ(""); setItems([]); }
  }, [open]);

  useEffect(() => {
    if (!user || !open) return;
    if (!q.trim()) { setItems([]); return; }
    const handle = setTimeout(async () => {
      setLoading(true);
      const term = `%${q.trim()}%`;
      const { data: bs } = await supabase.from("buildings").select("id, name, name_en, city").or(`name.ilike.${term},name_en.ilike.${term},city.ilike.${term}`).limit(8);
      const bIds = (bs || []).map((b: any) => b.id);
      const buildingMap = new Map((bs || []).map((b: any) => [b.id, b.name || b.name_en || "—"]));

      let userBuildings: any[] = [];
      if (!bs?.length) {
        const { data } = await supabase.from("buildings").select("id, name, name_en").eq("user_id", user.id);
        userBuildings = data || [];
      }
      const allBIds = bs?.length ? bIds : userBuildings.map((b: any) => b.id);
      const allBMap = bs?.length ? buildingMap : new Map(userBuildings.map((b: any) => [b.id, b.name || b.name_en]));

      const { data: us } = allBIds.length
        ? await supabase.from("units").select("id, unit_number, building_id, tenant_name, tenant_phone")
            .in("building_id", allBIds)
            .or(`unit_number.ilike.${term},tenant_name.ilike.${term},tenant_phone.ilike.${term}`)
            .limit(15)
        : { data: [] as any[] };

      const { data: ps } = allBIds.length
        ? await supabase.from("payments").select("id, unit_id, receipt_number, amount, payment_date")
            .ilike("receipt_number", term).limit(8)
        : { data: [] as any[] };

      const results: SearchItem[] = [];
      (bs || []).forEach((b: any) => results.push({
        type: "building", id: b.id, title: b.name || b.name_en, subtitle: b.city || "", to: `/buildings/${b.id}`,
      }));
      (us || []).forEach((u: any) => {
        if (u.tenant_name) {
          results.push({ type: "tenant", id: u.id, title: u.tenant_name, subtitle: `${allBMap.get(u.building_id) || ""} · ${u.unit_number}`, to: `/units/${u.id}` });
        } else {
          results.push({ type: "unit", id: u.id, title: `${allBMap.get(u.building_id) || ""} · ${u.unit_number}`, subtitle: ar ? "وحدة" : "Unit", to: `/units/${u.id}` });
        }
      });
      (ps || []).forEach((p: any) => results.push({
        type: "payment", id: p.id, title: `${ar ? "إيصال" : "Receipt"} #${p.receipt_number}`, subtitle: `${p.amount} · ${p.payment_date}`, to: `/payments`,
      }));
      setItems(results);
      setLoading(false);
    }, 250);
    return () => clearTimeout(handle);
  }, [q, user, open, ar]);


  if (!open) return null;

  const icons = {
    building: <Building2 className="h-4 w-4" />,
    unit: <DoorOpen className="h-4 w-4" />,
    tenant: <User className="h-4 w-4" />,
    payment: <Receipt className="h-4 w-4" />,
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={onClose}>
      <div className="max-w-[430px] mx-auto pt-16 px-4" onClick={(e) => e.stopPropagation()}>
        <div className="bg-card rounded-2xl shadow-glow border border-sage-200/40 overflow-hidden">
          <div className="flex items-center gap-2 p-3 border-b border-sage-200/40">
            <Search className="h-4 w-4 text-sage-400" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={ar ? "ابحث في كل بياناتك..." : "Search all your data..."}
              className="border-0 focus-visible:ring-0 h-9 px-0"
            />
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {loading && <p className="text-center text-xs text-muted-foreground py-6">{ar ? "جاري البحث..." : "Searching..."}</p>}
            {!loading && q && items.length === 0 && <p className="text-center text-xs text-muted-foreground py-6">{ar ? "لا توجد نتائج" : "No matches"}</p>}
            {!loading && !q && <p className="text-center text-xs text-muted-foreground py-6">{ar ? "اكتب للبحث في كل بياناتك" : "Type to search all your data"}</p>}
            {items.map((it) => (
              <Link key={`${it.type}-${it.id}`} to={it.to} onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-sage-100/60 transition-colors border-b border-sage-200/20 last:border-0">
                <div className="h-8 w-8 rounded-lg bg-sage-100 text-sage-500 flex items-center justify-center flex-shrink-0">{icons[it.type]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-sage-600 truncate">{it.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{it.subtitle}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
