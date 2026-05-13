import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useT2 } from "@/lib/i18n2";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

interface UnitOpt {
  id: string;
  unit_number: string;
  building_name: string;
  rent_amount: number;
  tenant_name: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
  presetUnitId?: string;
}

const PAYMENT_METHODS = ["cash", "transfer", "cheque", "card"] as const;

const AR_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const EN_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthRange(year: number, month1to12: number) {
  const y = year, m = month1to12 - 1;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const end = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

function yearOptions() {
  const cur = new Date().getFullYear();
  const out: number[] = [];
  for (let y = cur + 2; y >= 2020; y--) out.push(y);
  return out;
}

const schema = z.object({
  unit_id: z.string().uuid({ message: "Select a unit" }),
  amount: z.number().positive().max(10_000_000),
  payment_date: z.string().min(1),
  receipt_number: z.string().trim().max(50).optional().or(z.literal("")),
});

export function AddPaymentDialog({ open, onOpenChange, onSaved, presetUnitId }: Props) {
  const t2 = useT2();
  const { lang } = useI18n();
  const { format } = useCurrency();
  const [units, setUnits] = useState<UnitOpt[]>([]);
  const [unitId, setUnitId] = useState(presetUnitId || "");
  const [expected, setExpected] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [receipt, setReceipt] = useState("");
  const [method, setMethod] = useState<string>("cash");
  const [notes, setNotes] = useState("");
  const [periodMonth, setPeriodMonth] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: us } = await supabase.from("units").select("id, unit_number, tenant_name, rent_amount, building_id").order("unit_number");
      const ids = Array.from(new Set((us || []).map((u: any) => u.building_id)));
      const { data: bs } = ids.length
        ? await supabase.from("buildings").select("id, name, name_en").in("id", ids)
        : { data: [] as any[] };
      const bMap = new Map((bs || []).map((b: any) => [b.id, b]));
      const opts: UnitOpt[] = (us || []).map((u: any) => ({
        id: u.id,
        unit_number: u.unit_number,
        tenant_name: u.tenant_name,
        rent_amount: Number(u.rent_amount),
        building_name: bMap.get(u.building_id)?.name || bMap.get(u.building_id)?.name_en || "—",
      }));
      setUnits(opts);
      if (presetUnitId) {
        setUnitId(presetUnitId);
        const u = opts.find((x) => x.id === presetUnitId);
        if (u) {
          setExpected(String(u.rent_amount));
          if (!amount) setAmount(String(u.rent_amount));
        }
      }
      if (!receipt) setReceipt(`R-${Date.now()}`);
      const moOpts = getMonthOptions(lang);
      const cur = moOpts.find((o) => o.value === new Date().toISOString().slice(0, 7)) || moOpts[2];
      setPeriodMonth(cur.value);
      setPeriodStart(cur.start);
      setPeriodEnd(cur.end);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetUnitId]);

  const onPickUnit = (id: string) => {
    setUnitId(id);
    const u = units.find((x) => x.id === id);
    if (u) { setAmount(String(u.rent_amount)); setExpected(String(u.rent_amount)); }
  };

  const onPickMonth = (val: string) => {
    const moOpts = getMonthOptions(lang);
    const opt = moOpts.find((o) => o.value === val);
    if (opt) {
      setPeriodMonth(opt.value);
      setPeriodStart(opt.start);
      setPeriodEnd(opt.end);
    }
  };

  const remaining = Math.max(0, (Number(expected) || 0) - (Number(amount) || 0));
  const isPartial = Number(amount) > 0 && Number(expected) > 0 && Number(amount) < Number(expected);

  const submit = async () => {
    const parsed = schema.safeParse({
      unit_id: unitId,
      amount: Number(amount),
      payment_date: date,
      receipt_number: receipt.trim(),
    });
    if (!parsed.success) {
      return toast.error(parsed.error.issues[0].message);
    }
    setSaving(true);
    const { data: activeT } = await supabase.from("tenancies").select("id").eq("unit_id", unitId).eq("status", "active").maybeSingle();
    const { error } = await supabase.from("payments").insert({
      unit_id: unitId,
      tenancy_id: (activeT as any)?.id || null,
      amount: Number(amount),
      expected_amount: Number(expected) || null,
      payment_date: date,
      receipt_number: receipt.trim() || null,
      payment_method: method,
      notes: notes.trim() || null,
      period_start: periodStart || null,
      period_end: periodEnd || null,
    });
    if (!error) {
      const newStatus = isPartial ? "soon" : "paid";
      await supabase.from("units").update({ last_paid_date: date, status: newStatus }).eq("id", unitId);
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("✓");
    setAmount(""); setReceipt(""); setNotes(""); if (!presetUnitId) setUnitId("");
    onOpenChange(false);
    onSaved?.();
  };

  const monthOpts = getMonthOptions(lang);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sage-600">{t2("register_payment")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-sage-500">{t2("unit_number")}</Label>
            <Select value={unitId} onValueChange={onPickUnit} disabled={!!presetUnitId}>
              <SelectTrigger className="rounded-xl border-sage-200 bg-card h-11">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {units.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.building_name} · {u.unit_number}{u.tenant_name ? ` — ${u.tenant_name}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Rent month */}
          <div className="space-y-1.5">
            <Label className="text-xs text-sage-500">{t2("rent_month")}</Label>
            <Select value={periodMonth} onValueChange={onPickMonth}>
              <SelectTrigger className="rounded-xl border-sage-200 bg-card h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOpts.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500">{lang === "ar" ? "المتوقع" : "Expected"}</Label>
              <Input type="number" inputMode="decimal" value={expected} onChange={(e) => setExpected(e.target.value)} className="rounded-xl border-sage-200 bg-card h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500">{lang === "ar" ? "المدفوع" : "Paid"}</Label>
              <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-xl border-sage-200 bg-card h-11" />
            </div>
          </div>
          {isPartial && (
            <div className="bg-terracotta/10 border border-terracotta/30 rounded-xl px-3 py-2 text-xs text-terracotta font-semibold flex justify-between">
              <span>{lang === "ar" ? "متبقي" : "Remaining"}</span>
              <span>{format(remaining)}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500">{t2("payment_date")}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border-sage-200 bg-card h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500">{lang === "ar" ? "الطريقة" : "Method"}</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="rounded-xl border-sage-200 bg-card h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>{methodLabel(m, lang)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-sage-500">{t2("receipt_number")}</Label>
            <Input value={receipt} onChange={(e) => setReceipt(e.target.value)} maxLength={50} className="rounded-xl border-sage-200 bg-card h-11" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-sage-500">{t2("notes")}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="rounded-xl border-sage-200 bg-card" />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">{t2("cancel")}</Button>
          <Button onClick={submit} disabled={saving} className="rounded-xl bg-gradient-sage text-primary-foreground">{t2("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function methodLabel(m: string, lang: string) {
  const ar: Record<string, string> = { cash: "نقدي", transfer: "تحويل", cheque: "شيك", card: "بطاقة" };
  const en: Record<string, string> = { cash: "Cash", transfer: "Transfer", cheque: "Cheque", card: "Card" };
  return (lang === "ar" ? ar : en)[m] || m;
}
