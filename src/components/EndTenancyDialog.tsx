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
import { computeBalance } from "@/lib/balance";
import { toast } from "sonner";
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
    (async () => {
      const { data: ps } = await supabase
        .from("payments")
        .select("unit_id,amount,deleted_at")
        .eq("unit_id", unit.id)
        .is("deleted_at", null);
      const bal = computeBalance(unit, (ps || []) as any);
      setOutstanding(bal.outstanding);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, unit?.id]);

  const refundNum = depositOutcome === "full"
    ? Number(unit?.security_deposit) || 0
    : depositOutcome === "kept"
      ? 0
      : Number(refundAmount) || 0;

  const submit = async () => {
    if (!unit || !tenancyId) return;
    setSaving(true);
    const finalOutstanding = debtAction === "settle" ? 0 : outstanding;
    const { error: tErr } = await supabase.from("tenancies").update({
      status: "ended",
      ended_at: endDate,
      ended_reason: reason,
      outstanding_at_end: finalOutstanding,
      deposit_status: depositOutcome === "full" ? "refunded" : depositOutcome === "kept" ? "kept" : "partial",
      deposit_refund_amount: refundNum,
      deposit_refunded_at: refundNum > 0 ? endDate : null,
      notes: notes || null,
    }).eq("id", tenancyId);
    if (tErr) { setSaving(false); return toast.error(tErr.message); }

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
      last_paid_date: null,
      status: "vacant",
    }).eq("id", unit.id);
    setSaving(false);
    if (uErr) return toast.error(uErr.message);
    toast.success(t2("tenancy_ended_ok"));
    onOpenChange(false);
    onDone();
  };

  if (!unit) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-burgundy">{t2("end_tenancy")} — {unit.tenant_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
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
                  <span>{t2("carry_debt")}</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="radio" checked={debtAction === "settle"} onChange={() => setDebtAction("settle")} />
                  <span>{t2("settle_debt")}</span>
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
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">{t2("cancel")}</Button>
          <Button onClick={submit} disabled={saving} className="rounded-xl bg-burgundy hover:bg-burgundy/90 text-primary-foreground">
            {t2("end_tenancy")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
