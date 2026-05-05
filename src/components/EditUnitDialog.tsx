import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT2 } from "@/lib/i18n2";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const UNIT_TYPES = ["apartment", "shop", "room", "villa"] as const;
const RENT_TYPES = ["monthly", "daily", "yearly"] as const;
const STATUSES = ["vacant", "soon", "paid", "late"] as const;

interface UnitInput {
  id: string;
  unit_number: string;
  floor: number;
  type: string;
  status: string;
  tenant_name: string | null;
  tenant_phone: string | null;
  rent_amount: number;
  rent_type: string;
  due_day: number;
}

export function EditUnitDialog({
  open, onOpenChange, unit, floors, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  unit: UnitInput | null;
  floors: number;
  onSaved?: () => void;
}) {
  const t2 = useT2();
  const [unitNumber, setUnitNumber] = useState("");
  const [floor, setFloor] = useState("1");
  const [type, setType] = useState<string>("apartment");
  const [status, setStatus] = useState<string>("vacant");
  const [tenantName, setTenantName] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [rentAmount, setRentAmount] = useState("0");
  const [rentType, setRentType] = useState<string>("monthly");
  const [dueDay, setDueDay] = useState("1");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!unit) return;
    setUnitNumber(unit.unit_number);
    setFloor(String(unit.floor));
    setType(unit.type);
    setStatus(unit.status);
    setTenantName(unit.tenant_name || "");
    setTenantPhone(unit.tenant_phone || "");
    setRentAmount(String(unit.rent_amount ?? 0));
    setRentType(unit.rent_type);
    setDueDay(String(unit.due_day ?? 1));
  }, [unit]);

  if (!unit) return null;

  const occupied = status !== "vacant";

  const submit = async () => {
    if (!unitNumber.trim()) return;
    if (occupied && !tenantName.trim()) return toast.error(t2("tenant_required"));
    setBusy(true);
    const { error } = await supabase.from("units").update({
      unit_number: unitNumber.trim(),
      floor: Math.max(1, parseInt(floor) || 1),
      type,
      status,
      tenant_name: occupied ? tenantName.trim() : null,
      tenant_phone: occupied ? tenantPhone.trim() || null : null,
      rent_amount: parseFloat(rentAmount) || 0,
      rent_type: rentType,
      due_day: Math.min(31, Math.max(1, parseInt(dueDay) || 1)),
    }).eq("id", unit.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("✓");
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px] rounded-3xl border-sage-200 bg-background max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sage-600 text-xl font-black">{t2("edit_unit")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t2("unit_number")}>
              <Input value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} className="rounded-xl border-sage-200 bg-card" />
            </Field>
            <Field label={t2("floors")}>
              <Input type="number" inputMode="numeric" min={1} max={floors} value={floor}
                onChange={(e) => setFloor(e.target.value)}
                className="rounded-xl border-sage-200 bg-card" />
            </Field>
          </div>

          <Field label={t2("unit_type")}>
            <div className="flex flex-wrap gap-1.5">
              {UNIT_TYPES.map((tp) => (
                <button key={tp} type="button" onClick={() => setType(tp)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                    type === tp ? "bg-gradient-sage text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground"
                  }`}>{t2(tp as any)}</button>
              ))}
            </div>
          </Field>

          <Field label={t2("status")}>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
                <button key={s} type="button" onClick={() => setStatus(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                    status === s ? "bg-gradient-sage text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground"
                  }`}>{t2(s as any)}</button>
              ))}
            </div>
          </Field>

          {occupied && (
            <>
              <Field label={`${t2("tenant_name")} *`}>
                <Input value={tenantName} onChange={(e) => setTenantName(e.target.value)} className="rounded-xl border-sage-200 bg-card" />
              </Field>
              <Field label={t2("tenant_phone")}>
                <Input value={tenantPhone} onChange={(e) => setTenantPhone(e.target.value)} className="rounded-xl border-sage-200 bg-card" />
              </Field>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label={t2("rent_amount")}>
              <Input type="number" inputMode="decimal" min={0} step="0.001" value={rentAmount}
                onChange={(e) => setRentAmount(e.target.value)}
                className="rounded-xl border-sage-200 bg-card" />
            </Field>
            <Field label={t2("due_day")}>
              <Input type="number" inputMode="numeric" min={1} max={31} value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                className="rounded-xl border-sage-200 bg-card" />
            </Field>
          </div>
          <Field label={t2("rent_type")}>
            <div className="flex gap-1.5">
              {RENT_TYPES.map((rt) => (
                <button key={rt} type="button" onClick={() => setRentType(rt)}
                  className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold ${
                    rentType === rt ? "bg-gradient-sage text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground"
                  }`}>{t2(rt as any)}</button>
              ))}
            </div>
          </Field>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1 rounded-xl border-sage-200" onClick={() => onOpenChange(false)}>{t2("cancel")}</Button>
            <Button onClick={submit} disabled={busy || !unitNumber.trim()} className="flex-1 rounded-xl bg-gradient-sage text-primary-foreground font-semibold">{t2("save")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-sage-600 font-semibold">{label}</Label>
      {children}
    </div>
  );
}
