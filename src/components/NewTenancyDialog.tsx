import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT2 } from "@/lib/i18n2";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  unit: any;
  onDone: () => void;
}

export function NewTenancyDialog({ open, onOpenChange, unit, onDone }: Props) {
  const t2 = useT2();
  const { lang } = useI18n();
  const today = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState("");
  const [contractType, setContractType] = useState("yearly");
  const [rent, setRent] = useState("");
  const [rentType, setRentType] = useState("monthly");
  const [dueDay, setDueDay] = useState("1");
  const [deposit, setDeposit] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !unit) return;
    setName(""); setPhone(""); setEmail(""); setIdNumber("");
    setStartDate(today); setEndDate("");
    setContractType("yearly");
    setRent(String(unit.rent_amount || ""));
    setRentType(unit.rent_type || "monthly");
    setDueDay(String(unit.due_day || 1));
    setDeposit("0");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, unit?.id]);

  const submit = async () => {
    if (!unit) return;
    if (!name.trim()) return toast.error(lang === "ar" ? "اسم المستأجر مطلوب" : "Tenant name required");
    setSaving(true);
    const rentNum = Number(rent) || 0;
    const dueNum = Math.min(31, Math.max(1, Number(dueDay) || 1));
    const depositNum = Number(deposit) || 0;
    const { error: tErr } = await supabase.from("tenancies").insert({
      building_id: unit.building_id,
      unit_id: unit.id,
      tenant_name: name.trim(),
      tenant_phone: phone.trim() || null,
      tenant_email: email.trim() || null,
      tenant_id_number: idNumber.trim() || null,
      contract_start_date: startDate,
      contract_end_date: endDate || null,
      contract_type: contractType,
      rent_amount: rentNum,
      rent_type: rentType,
      due_day: dueNum,
      security_deposit: depositNum,
      deposit_status: depositNum > 0 ? "held" : "none",
      status: "active",
    });
    if (tErr) { setSaving(false); return toast.error(tErr.message); }

    const { error: uErr } = await supabase.from("units").update({
      tenant_name: name.trim(),
      tenant_phone: phone.trim() || null,
      tenant_email: email.trim() || null,
      tenant_id_number: idNumber.trim() || null,
      contract_start_date: startDate,
      contract_end_date: endDate || null,
      contract_type: contractType,
      rent_amount: rentNum,
      rent_type: rentType,
      due_day: dueNum,
      security_deposit: depositNum,
      deposit_status: depositNum > 0 ? "held" : "none",
      status: "soon",
    }).eq("id", unit.id);
    setSaving(false);
    if (uErr) return toast.error(uErr.message);
    toast.success(t2("tenancy_started_ok"));
    onOpenChange(false);
    onDone();
  };

  if (!unit) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sage-600">{t2("new_tenant")} — {unit.unit_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-sage-500">{t2("tenant_name")} *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl border-sage-200 h-11" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500">{t2("tenant_phone")}</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-xl border-sage-200 h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500">ID</Label>
              <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} className="rounded-xl border-sage-200 h-11" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-sage-500">{lang === "ar" ? "البريد الإلكتروني" : "Email"}</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl border-sage-200 h-11" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500">{t2("contract_start_date")}</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-xl border-sage-200 h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500">{t2("contract_end")}</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-xl border-sage-200 h-11" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500">{t2("rent_amount")}</Label>
              <Input type="number" inputMode="decimal" value={rent} onChange={(e) => setRent(e.target.value)} className="rounded-xl border-sage-200 h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500">{t2("rent_type")}</Label>
              <Select value={rentType} onValueChange={setRentType}>
                <SelectTrigger className="rounded-xl border-sage-200 h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">{t2("monthly")}</SelectItem>
                  <SelectItem value="daily">{t2("daily")}</SelectItem>
                  <SelectItem value="yearly">{t2("yearly")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500">{t2("due_day")}</Label>
              <Input type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} className="rounded-xl border-sage-200 h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500">{lang === "ar" ? "تأمين" : "Deposit"}</Label>
              <Input type="number" inputMode="decimal" value={deposit} onChange={(e) => setDeposit(e.target.value)} className="rounded-xl border-sage-200 h-11" />
            </div>
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
