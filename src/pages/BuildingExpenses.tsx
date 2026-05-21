import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Wrench, Zap, Droplet, Receipt, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { useT2 } from "@/lib/i18n2";
import { useCurrency } from "@/lib/currency";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";

interface Expense {
  id: string;
  category: string;
  amount: number;
  expense_date: string;
  description: string | null;
  vendor: string | null;
}

const CATEGORIES = [
  { key: "maintenance", icon: Wrench },
  { key: "electric", icon: Zap },
  { key: "water", icon: Droplet },
  { key: "fees", icon: Receipt },
  { key: "other", icon: MoreHorizontal },
];

export default function BuildingExpenses() {
  const { id } = useParams();
  const { t, lang } = useI18n();
  const t2 = useT2();
  const { format } = useCurrency();
  const [building, setBuilding] = useState<{ name: string } | null>(null);
  const [items, setItems] = useState<Expense[]>([]);
  const [income, setIncome] = useState(0);
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState("maintenance");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [vendor, setVendor] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null);

  const load = async () => {
    if (!id) return;
    const { data: b } = await supabase.from("buildings").select("name").eq("id", id).maybeSingle();
    setBuilding(b);
    const { data: ex } = await supabase.from("expenses").select("*").eq("building_id", id).order("expense_date", { ascending: false });
    setItems((ex as Expense[]) || []);
    const { data: us } = await supabase.from("units").select("id").eq("building_id", id);
    const unitIds = (us || []).map((u: any) => u.id);
    if (unitIds.length) {
      const { data: ps } = await supabase.from("payments").select("amount").in("unit_id", unitIds);
      setIncome((ps || []).reduce((s: number, p: any) => s + Number(p.amount), 0));
    }
  };

  useEffect(() => { load(); }, [id]);

  const add = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error(lang === "ar" ? "أدخل المبلغ" : "Enter amount");
    setBusy(true);
    const { error } = await supabase.from("expenses").insert({
      building_id: id, category: cat, amount: amt, expense_date: date,
      vendor: vendor.trim() || null, description: desc.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("✓");
    await logActivity({
      entityType: "expense", action: "created", buildingId: id || null,
      entityLabel: `${cat} — ${amt}`,
      descriptionAr: `إضافة مصروف ${cat}: ${amt}${vendor ? ` (${vendor})` : ""}`,
      descriptionEn: `Expense added (${cat}): ${amt}${vendor ? ` — ${vendor}` : ""}`,
      changes: { category: cat, amount: amt, vendor: vendor || null },
    });
    setAmount(""); setVendor(""); setDesc(""); setOpen(false);
    load();
  };

  const confirmRemove = async () => {
    const item = pendingDelete;
    if (!item) return;
    setPendingDelete(null);
    const { error } = await supabase.from("expenses").delete().eq("id", item.id);
    if (error) return toast.error(error.message);
    await logActivity({
      entityType: "expense", action: "deleted", buildingId: id || null,
      entityLabel: `${item.category} — ${item.amount}`,
      descriptionAr: `حذف مصروف: ${item.category} - ${item.amount}`,
      descriptionEn: `Expense deleted: ${item.category} - ${item.amount}`,
    });
    toast.success(lang === "ar" ? "تم الحذف" : "Deleted");
    load();
  };

  const total = items.reduce((s, x) => s + Number(x.amount), 0);
  const net = income - total;

  return (
    <div className="mobile-shell min-h-screen pb-10">
      <div className="relative overflow-hidden bg-gradient-deep text-primary-foreground pt-4 pb-6 px-5 rounded-b-[2rem]">
        <div className="flex items-center justify-between mb-3">
          <Link to={`/buildings/${id}`}>
            <Button variant="ghost" size="icon" className="rounded-full text-primary-foreground hover:bg-card/15">
              <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
            </Button>
          </Link>
          <h1 className="text-lg font-black">{lang === "ar" ? "المصروفات" : "Expenses"}</h1>
          <div className="w-9" />
        </div>
        {building && <p className="text-sm opacity-80 text-center">{building.name}</p>}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <Mini label={lang === "ar" ? "الدخل" : "Income"} value={format(income)} />
          <Mini label={lang === "ar" ? "المصروفات" : "Expenses"} value={format(total)} />
          <Mini label={lang === "ar" ? "الصافي" : "Net"} value={format(net)} highlight={net >= 0} />
        </div>
      </div>

      <div className="px-5 md:px-8 lg:px-12 -mt-4 relative z-10">
        <Button onClick={() => setOpen(true)} className="w-full h-12 rounded-2xl bg-gradient-sage text-primary-foreground font-bold shadow-soft mb-4">
          <Plus className="h-4 w-4 me-1.5" />{lang === "ar" ? "إضافة مصروف" : "Add expense"}
        </Button>

        <div className="space-y-2">
          {items.length === 0 ? (
            <div className="text-center py-12 text-sage-500 text-sm">{lang === "ar" ? "لا توجد مصروفات بعد" : "No expenses yet"}</div>
          ) : items.map((e) => {
            const c = CATEGORIES.find((x) => x.key === e.category) || CATEGORIES[4];
            const Icon = c.icon;
            return (
              <div key={e.id} className="bg-card border border-sage-200/40 rounded-2xl p-3.5 flex items-center gap-3 shadow-soft">
                <div className="h-10 w-10 rounded-xl bg-sage-100 text-sage-500 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sage-600 text-sm truncate">
                    {lang === "ar" ? catLabelAr(e.category) : catLabelEn(e.category)}
                    {e.vendor ? ` · ${e.vendor}` : ""}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">{e.expense_date}{e.description ? ` · ${e.description}` : ""}</p>
                </div>
                <p className="font-black text-burgundy whitespace-nowrap">{format(Number(e.amount))}</p>
                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-burgundy" onClick={() => setPendingDelete(e)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sage-600">{lang === "ar" ? "إضافة مصروف" : "Add expense"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-sage-500">{lang === "ar" ? "الفئة" : "Category"}</Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {CATEGORIES.map((c) => (
                  <button key={c.key} onClick={() => setCat(c.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold ${cat === c.key ? "bg-gradient-sage text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground"}`}>
                    {lang === "ar" ? catLabelAr(c.key) : catLabelEn(c.key)}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-sage-500">{t2("amount")}</Label>
                <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
                  className="rounded-xl border-sage-200 bg-card h-11 mt-1.5" />
              </div>
              <div>
                <Label className="text-xs text-sage-500">{t2("payment_date")}</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                  className="rounded-xl border-sage-200 bg-card h-11 mt-1.5" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-sage-500">{lang === "ar" ? "المورد" : "Vendor"}</Label>
              <Input value={vendor} onChange={(e) => setVendor(e.target.value)}
                className="rounded-xl border-sage-200 bg-card h-11 mt-1.5" />
            </div>
            <div>
              <Label className="text-xs text-sage-500">{t2("notes")}</Label>
              <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2}
                className="rounded-xl border-sage-200 bg-card mt-1.5" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setOpen(false)}>{t2("cancel")}</Button>
              <Button onClick={add} disabled={busy} className="flex-1 rounded-xl bg-gradient-sage text-primary-foreground">{t2("save")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Mini({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-card/15 backdrop-blur rounded-xl p-2.5 text-center">
      <p className="text-[10px] uppercase opacity-75">{label}</p>
      <p className={`font-black text-sm mt-0.5 truncate ${highlight === false ? "text-terracotta" : ""}`}>{value}</p>
    </div>
  );
}

function catLabelAr(k: string) {
  return { maintenance: "صيانة", electric: "كهرباء", water: "ماء", fees: "رسوم", other: "أخرى" }[k] || k;
}
function catLabelEn(k: string) {
  return { maintenance: "Maintenance", electric: "Electric", water: "Water", fees: "Fees", other: "Other" }[k] || k;
}
