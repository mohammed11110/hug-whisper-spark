import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT2 } from "@/lib/i18n2";
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

const schema = z.object({
  unit_id: z.string().uuid({ message: "Select a unit" }),
  amount: z.number().positive().max(10_000_000),
  payment_date: z.string().min(1),
  receipt_number: z.string().trim().max(50).optional().or(z.literal("")),
});

export function AddPaymentDialog({ open, onOpenChange, onSaved, presetUnitId }: Props) {
  const t2 = useT2();
  const [units, setUnits] = useState<UnitOpt[]>([]);
  const [unitId, setUnitId] = useState(presetUnitId || "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [receipt, setReceipt] = useState("");
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
        if (u && !amount) setAmount(String(u.rent_amount));
      }
      if (!receipt) setReceipt(`R-${Date.now()}`);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetUnitId]);

  const onPickUnit = (id: string) => {
    setUnitId(id);
    const u = units.find((x) => x.id === id);
    if (u) setAmount(String(u.rent_amount));
  };

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
    const { error } = await supabase.from("payments").insert({
      unit_id: unitId,
      amount: Number(amount),
      payment_date: date,
      receipt_number: receipt.trim() || null,
    });
    if (!error) {
      await supabase.from("units").update({ last_paid_date: date, status: "paid" }).eq("id", unitId);
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("✓");
    setAmount(""); setReceipt(""); if (!presetUnitId) setUnitId("");
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-md">
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
          <div className="space-y-1.5">
            <Label className="text-xs text-sage-500">{t2("amount")}</Label>
            <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-xl border-sage-200 bg-card h-11" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-sage-500">{t2("payment_date")}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border-sage-200 bg-card h-11" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-sage-500">{t2("receipt_number")}</Label>
            <Input value={receipt} onChange={(e) => setReceipt(e.target.value)} maxLength={50} className="rounded-xl border-sage-200 bg-card h-11" />
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
