import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT2 } from "@/lib/i18n2";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const UNIT_TYPES = ["apartment", "shop", "room", "villa"] as const;
const RENT_TYPES = ["monthly", "daily", "yearly"] as const;
const CONTRACT_TYPES = ["daily", "monthly", "yearly"] as const;

export function AddUnitDialog({ open, onOpenChange, buildingId, floors, onCreated }: {
  open: boolean; onOpenChange: (o: boolean) => void; buildingId: string; floors: number; onCreated?: () => void;
}) {
  const t2 = useT2();
  const [unitNumber, setUnitNumber] = useState("");
  const [floor, setFloor] = useState<string>("1");
  const [type, setType] = useState<typeof UNIT_TYPES[number]>("apartment");
  const [occupied, setOccupied] = useState(false);
  const [tenantName, setTenantName] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [rentAmount, setRentAmount] = useState<string>("0");
  const [rentType, setRentType] = useState<typeof RENT_TYPES[number]>("monthly");
  const [contractType, setContractType] = useState<typeof CONTRACT_TYPES[number]>("yearly");
  const [contractStart, setContractStart] = useState<string>("");
  const [dueDay, setDueDay] = useState<string>("1");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setUnitNumber(""); setFloor("1"); setType("apartment"); setOccupied(false);
    setTenantName(""); setTenantPhone(""); setRentAmount("0"); setRentType("monthly");
    setContractType("yearly"); setContractStart(""); setDueDay("1");
  };

  const submit = async () => {
    if (!unitNumber.trim()) return;
    if (occupied && (!tenantName.trim() || !tenantPhone.trim())) {
      return toast.error(t2("tenant_required"));
    }
    setBusy(true);
    const { error } = await supabase.from("units").insert({
      building_id: buildingId,
      unit_number: unitNumber.trim(),
      floor: Math.max(1, parseInt(floor) || 1),
      type,
      tenant_name: occupied ? tenantName.trim() : null,
      tenant_phone: occupied ? tenantPhone.trim() : null,
      rent_amount: occupied ? (parseFloat(rentAmount) || 0) : 0,
      rent_type: rentType,
      due_day: Math.min(31, Math.max(1, parseInt(dueDay) || 1)),
      status: occupied ? "soon" : "vacant",
      contract_type: contractType,
      contract_start_date: contractStart || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("✓");
    reset();
    onCreated?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px] rounded-3xl border-sage-200 bg-background max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sage-600 text-xl font-black">{t2("add_unit")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t2("unit_number")}>
              <Input value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} className="rounded-xl border-sage-200 bg-card" />
            </Field>
            <Field label={t2("floors")}>
              <Input type="number" inputMode="numeric" min={1} max={floors} value={floor}
                onChange={(e) => setFloor(e.target.value)}
                onBlur={() => { const n = parseInt(floor); if (!floor || isNaN(n) || n < 1) setFloor("1"); }}
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

          <Field label={t2("occupancy_status")}>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setOccupied(false)}
                className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold ${
                  !occupied ? "bg-gradient-sage text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground"
                }`}>{t2("vacant")}</button>
              <button type="button" onClick={() => setOccupied(true)}
                className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold ${
                  occupied ? "bg-gradient-sage text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground"
                }`}>{t2("rented")}</button>
            </div>
          </Field>

          {occupied && (
            <>
              <Field label={`${t2("tenant_name")} *`}>
                <Input value={tenantName} onChange={(e) => setTenantName(e.target.value)} className="rounded-xl border-sage-200 bg-card" />
              </Field>
              <Field label={`${t2("tenant_phone")} *`}>
                <Input value={tenantPhone} onChange={(e) => setTenantPhone(e.target.value)} className="rounded-xl border-sage-200 bg-card" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t2("rent_amount")}>
                  <Input type="number" inputMode="decimal" min={0} step="0.001" value={rentAmount}
                    onChange={(e) => setRentAmount(e.target.value)}
                    onBlur={() => { if (!rentAmount) setRentAmount("0"); }}
                    className="rounded-xl border-sage-200 bg-card" />
                </Field>
                <Field label={t2("due_day")}>
                  <Input type="number" inputMode="numeric" min={1} max={31} value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    onBlur={() => { const n = parseInt(dueDay); if (!dueDay || isNaN(n) || n < 1) setDueDay("1"); }}
                    className="rounded-xl border-sage-200 bg-card" />
                </Field>
              </div>
              <Field label="نوع العقد / Contract type">
                <div className="flex gap-1.5">
                  {CONTRACT_TYPES.map((ct) => (
                    <button key={ct} type="button" onClick={() => setContractType(ct)}
                      className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold ${
                        contractType === ct ? "bg-gradient-sage text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground"
                      }`}>{t2(ct)}</button>
                  ))}
                </div>
              </Field>
              <Field label="تاريخ بداية العقد / Contract start">
                <Input type="date" value={contractStart} onChange={(e) => setContractStart(e.target.value)}
                  className="rounded-xl border-sage-200 bg-card" />
              </Field>
              <Field label={`${t2("rent_type")} (دورة الدفع)`}>
                <div className="flex gap-1.5">
                  {RENT_TYPES.map((rt) => (
                    <button key={rt} type="button" onClick={() => setRentType(rt)}
                      className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold ${
                        rentType === rt ? "bg-gradient-sage text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground"
                      }`}>{t2(rt)}</button>
                  ))}
                </div>
              </Field>
            </>
          )}

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
