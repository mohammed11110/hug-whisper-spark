import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT2 } from "@/lib/i18n2";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { supabase } from "@/integrations/supabase/client";
import { getUnitArrears } from "@/lib/balance";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";
import { useUnsavedGuard } from "@/lib/useUnsavedGuard";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  unit: any;
  tenancyId: string | null;
  onDone: () => void;
}

export function EndTenancyDialog({ open, onOpenChange, unit, tenancyId, onDone }: Props) {
  const t2 = useT2();
  const { lang } = useI18n();
  const { format } = useCurrency();
  const today = new Date().toISOString().slice(0, 10);
  const [endDate, setEndDate] = useState(today);
  const [reason, setReason] = useState<string>("end_of_contract");
  const [depositOutcome, setDepositOutcome] = useState<"full" | "partial" | "kept">("full");
  const [refundAmount, setRefundAmount] = useState("");
  const [debtAction, setDebtAction] = useState<"settle" | "carry">("carry");
  const [notes, setNotes] = useState("");
  const [outstanding, setOutstanding] = useState(0);
  const [contractNumber, setContractNumber] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const guard = useUnsavedGuard({ open, onOpenChange });


  useEffect(() => {
    if (!open || !unit) return;
    setEndDate(today);
    setReason("end_of_contract");
    setDepositOutcome("full");
    setRefundAmount(String(Number(unit.security_deposit) || 0));
    setDebtAction("carry");
    setNotes("");
    setContractNumber(null);
    (async () => {
      const { data: ps } = await supabase
        .from("payments")
        .select("unit_id,amount,deleted_at,payment_date,period_start,period_end,tenancy_id,kind")
        .eq("unit_id", unit.id)
        .is("deleted_at", null);
      const arr = getUnitArrears(unit, (ps || []) as any, new Date(), lang as "ar" | "en", tenancyId);
      setOutstanding(arr.totalShortfall);

      // اجلب رقم العقد لعرضه في العنوان وفي سجل النشاط.
      let tid = tenancyId;
      if (!tid) {
        const { data: latest } = await supabase
          .from("tenancies").select("id,contract_number")
          .eq("unit_id", unit.id)
          .order("created_at", { ascending: false }).limit(1);
        if (latest?.[0]) setContractNumber((latest[0] as any).contract_number || null);
      } else {
        const { data: t } = await supabase
          .from("tenancies").select("contract_number").eq("id", tid).maybeSingle();
        setContractNumber((t as any)?.contract_number || null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, unit?.id]);


  const refundNum = depositOutcome === "full"
    ? Number(unit?.security_deposit) || 0
    : depositOutcome === "kept"
      ? 0
      : Number(refundAmount) || 0;

  const submit = async () => {
    if (!unit) return;
    setSaving(true);
    const finalOutstanding = debtAction === "settle" ? 0 : outstanding;
    const tenancyPayload = {
      status: "ended",
      ended_at: endDate,
      ended_reason: reason,
      outstanding_at_end: finalOutstanding,
      deposit_status: depositOutcome === "full" ? "refunded" : depositOutcome === "kept" ? "kept" : "partial",
      deposit_refund_amount: refundNum,
      deposit_refunded_at: refundNum > 0 ? endDate : null,
      notes: notes || null,
    };

    let resolvedTenancyId = tenancyId;

    if (resolvedTenancyId) {
      const { error: tErr } = await supabase.from("tenancies").update(tenancyPayload).eq("id", resolvedTenancyId);
      if (tErr) { setSaving(false); return toast.error(tErr.message); }
    } else {
      // Fallback: no active tenancy linked. Try to find the most recent tenancy row
      // for this unit and close it; otherwise create a historical record so the
      // tenancy still appears in the lease history.
      const { data: existing } = await supabase
        .from("tenancies")
        .select("id,status")
        .eq("unit_id", unit.id)
        .order("created_at", { ascending: false })
        .limit(1);
      const fallback = (existing || [])[0];
      if (fallback?.id) {
        resolvedTenancyId = fallback.id;
        const { error: tErr } = await supabase.from("tenancies").update(tenancyPayload).eq("id", resolvedTenancyId);
        if (tErr) { setSaving(false); return toast.error(tErr.message); }
      } else {
        const { error: insErr } = await supabase.from("tenancies").insert({
          unit_id: unit.id,
          building_id: unit.building_id,
          tenant_name: unit.tenant_name || null,
          tenant_phone: unit.tenant_phone || null,
          tenant_email: unit.tenant_email || null,
          contract_start_date: unit.contract_start_date || endDate,
          contract_end_date: unit.contract_end_date || endDate,
          rent_amount: Number(unit.rent_amount) || 0,
          rent_type: unit.rent_type || "monthly",
          due_day: unit.due_day || 1,
          security_deposit: Number(unit.security_deposit) || 0,
          ...tenancyPayload,
        } as any);
        if (insErr) { setSaving(false); return toast.error(insErr.message); }
      }
    }

    // Clear tenant info from unit + mark vacant
    const { error: uErr } = await supabase.from("units").update({
      tenant_name: null,
      tenant_phone: null,
      tenant_email: null,
      tenant_id_type: null,
      tenant_id_number: null,
      tenant_id_image_url: null,
      contract_start_date: null,
      contract_end_date: null,
      security_deposit: 0,
      deposit_status: "none",
      opening_balance: 0,
      opening_balance_date: null,
      paid_up_to: null,
      last_paid_date: null,
      status: "vacant",
    } as any).eq("id", unit.id);
    setSaving(false);
    if (uErr) return toast.error(uErr.message);
    logActivity({
      entityType: "tenant",
      action: "ended",
      entityId: unit.id,
      entityLabel: unit.tenant_name || "",
      buildingId: unit.building_id,
      descriptionAr: `إنهاء عقد المستأجر ${unit.tenant_name || ""} — وحدة ${unit.unit_number}`,
      descriptionEn: `Tenancy ended for ${unit.tenant_name || ""} — unit ${unit.unit_number}`,
      changes: { reason, ended_at: endDate, outstanding: finalOutstanding, deposit_refund: refundNum },
    });
    // Broadcast so every screen (Tenants, Payments, Notifications, Dashboard,
    // UnitDetail) drops the previous tenant's cached balance immediately.
    const { paymentsBus } = await import("@/lib/paymentsBus");
    paymentsBus.emit(unit.id);
    toast.success(t2("tenancy_ended_ok"));
    guard.markSaved();
    onOpenChange(false);
    onDone();
  };

  if (!unit) return null;

  return (
    <Dialog open={open} onOpenChange={guard.handleOpenChange}>
      <DialogContent className="rounded-2xl max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-burgundy">
            {t2("end_tenancy")} — {unit.tenant_name}
            {contractNumber && (
              <span className="block text-[11px] font-semibold text-sage-500 mt-0.5 tracking-wide">
                {contractNumber}
              </span>
            )}
          </DialogTitle>

        </DialogHeader>
        <div className="space-y-3" {...guard.formProps}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500">{t2("end_date")}</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-xl border-sage-200 h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500">{t2("end_reason")}</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="rounded-xl border-sage-200 h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="end_of_contract">{lang === "ar" ? "نهاية العقد" : "End of contract"}</SelectItem>
                  <SelectItem value="tenant_left">{lang === "ar" ? "انسحاب المستأجر" : "Tenant withdrew"}</SelectItem>
                  <SelectItem value="evicted">{lang === "ar" ? "إخلاء قسري" : "Eviction"}</SelectItem>
                  <SelectItem value="other">{lang === "ar" ? "أخرى" : "Other"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Outstanding */}
          <div className="rounded-xl border border-sage-200/60 bg-sage-300/10 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t2("outstanding_balance")}</span>
              <span className={`text-base font-black ${outstanding > 0 ? "text-burgundy" : "text-sage-600"}`}>{format(outstanding)}</span>
            </div>
            {outstanding > 0 && (
              <div className="mt-2 space-y-1.5">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="radio" checked={debtAction === "carry"} onChange={() => setDebtAction("carry")} />
                  <span>{t2("carry_arrears")}</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="radio" checked={debtAction === "settle"} onChange={() => setDebtAction("settle")} />
                  <span>{t2("settle_arrears")}</span>
                </label>
              </div>
            )}
          </div>

          {/* Deposit */}
          {Number(unit.security_deposit) > 0 && (
            <div className="rounded-xl border border-sage-200/60 px-3 py-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t2("deposit_outcome")}</span>
                <span className="text-xs font-semibold text-sage-600">{format(Number(unit.security_deposit))}</span>
              </div>
              <Select value={depositOutcome} onValueChange={(v: any) => { setDepositOutcome(v); if (v === "full") setRefundAmount(String(unit.security_deposit)); if (v === "kept") setRefundAmount("0"); }}>
                <SelectTrigger className="rounded-xl border-sage-200 h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">{t2("deposit_full_refund")}</SelectItem>
                  <SelectItem value="partial">{t2("deposit_partial")}</SelectItem>
                  <SelectItem value="kept">{t2("deposit_kept")}</SelectItem>
                </SelectContent>
              </Select>
              {depositOutcome === "partial" && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-sage-500">{t2("refund_amount")}</Label>
                  <Input type="number" inputMode="decimal" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} className="rounded-xl border-sage-200 h-10" />
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs text-sage-500">{t2("notes")}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="rounded-xl border-sage-200" />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button data-guard-ignore variant="outline" onClick={() => guard.handleOpenChange(false)} className="rounded-xl">{t2("cancel")}</Button>
          <Button data-guard-ignore onClick={submit} disabled={saving} className="rounded-xl bg-burgundy hover:bg-burgundy/90 text-primary-foreground">
            {t2("end_tenancy")}
          </Button>
        </DialogFooter>
        {guard.ConfirmDiscardUI}
      </DialogContent>
    </Dialog>
  );
}
