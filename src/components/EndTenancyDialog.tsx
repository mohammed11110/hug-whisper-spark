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
import { useAppSettings, formatReceipt } from "@/lib/appSettings";
import { allocateReceiptNumbers } from "@/lib/receiptNumbering";
import { CheckCircle2, Wallet, FileMinus2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  unit: any;
  tenancyId: string | null;
  onDone: () => void;
}

type Resolution = "kept" | "collected" | "written_off";

export function EndTenancyDialog({ open, onOpenChange, unit, tenancyId, onDone }: Props) {
  const t2 = useT2();
  const { lang } = useI18n();
  const { format } = useCurrency();
  const { settings } = useAppSettings();
  const ar = lang === "ar";
  const today = new Date().toISOString().slice(0, 10);
  const [endDate, setEndDate] = useState(today);
  const [reason, setReason] = useState<string>("end_of_contract");
  const [depositOutcome, setDepositOutcome] = useState<"full" | "partial" | "kept">("full");
  const [refundAmount, setRefundAmount] = useState("");
  const [resolution, setResolution] = useState<Resolution>("kept");
  const [collectAmount, setCollectAmount] = useState<string>("");
  const [writeOffReason, setWriteOffReason] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer" | "cheque" | "card">("cash");
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
    setResolution("kept");
    setCollectAmount("");
    setWriteOffReason("");
    setPaymentMethod("cash");
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
      setCollectAmount(arr.totalShortfall > 0 ? arr.totalShortfall.toFixed(3) : "");

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

  const hasOutstanding = outstanding > 0.009;
  const collectAmountNum = Math.max(0, Number(collectAmount) || 0);
  const writeOffReasonOk = writeOffReason.trim().length >= 4;

  const submitDisabled = saving || (hasOutstanding && (
    (resolution === "collected" && (collectAmountNum + 0.009 < outstanding))
    || (resolution === "written_off" && !writeOffReasonOk)
  ));

  const submit = async () => {
    if (!unit) return;
    setSaving(true);

    let closingBalance = hasOutstanding ? outstanding : 0;
    let writeOffAmt: number | null = null;
    let writeOffReasonOut: string | null = null;
    let extraPaymentRow: any | null = null;
    const debtResolution: "kept" | "collected" | "written_off" | "none" =
      !hasOutstanding ? "none" : resolution;

    // Resolve active tenancy id up-front so we can attach any settlement row to it.
    let resolvedTenancyId = tenancyId;
    if (!resolvedTenancyId) {
      const { data: existing } = await supabase
        .from("tenancies")
        .select("id,status")
        .eq("unit_id", unit.id)
        .order("created_at", { ascending: false })
        .limit(1);
      const fallback = (existing || [])[0];
      if (fallback?.id) resolvedTenancyId = fallback.id;
    }

    if (hasOutstanding && resolution === "collected") {
      // Allocate one receipt number for the settlement payment.
      const alloc = await allocateReceiptNumbers(1);
      const cfg = alloc
        ? { prefix: alloc.prefix, padding: alloc.padding, startNumber: alloc.startNumber, nextNumber: alloc.startNumber }
        : settings.receipt;
      const startNum = alloc ? alloc.startNumber : (settings.receipt.nextNumber || settings.receipt.startNumber || 1);
      const receiptNumber = formatReceipt(cfg, startNum);
      extraPaymentRow = {
        unit_id: unit.id,
        tenancy_id: resolvedTenancyId,
        amount: collectAmountNum,
        expected_amount: outstanding,
        payment_date: endDate,
        receipt_number: receiptNumber,
        payment_method: paymentMethod,
        notes: (ar ? "تسوية عند الإخلاء" : "Eviction settlement") + (notes.trim() ? ` — ${notes.trim()}` : ""),
        period_start: null,
        period_end: null,
        kind: "rent",
      };
      closingBalance = Math.max(0, outstanding - collectAmountNum);
    } else if (hasOutstanding && resolution === "written_off") {
      extraPaymentRow = {
        unit_id: unit.id,
        tenancy_id: resolvedTenancyId,
        amount: outstanding,
        expected_amount: null,
        payment_date: endDate,
        receipt_number: null,
        payment_method: null,
        notes: (ar ? "شطب رصيد — " : "Write-off — ") + writeOffReason.trim(),
        period_start: null,
        period_end: null,
        kind: "adjustment",
      };
      writeOffAmt = outstanding;
      writeOffReasonOut = writeOffReason.trim();
      closingBalance = 0;
    }

    const tenancyPayload: any = {
      status: "ended",
      ended_at: endDate,
      ended_reason: reason,
      outstanding_at_end: closingBalance,
      closing_balance: closingBalance,
      debt_resolution: debtResolution,
      debt_settled: debtResolution !== "kept",
      debt_settled_at: debtResolution !== "kept" && hasOutstanding ? new Date().toISOString() : null,
      write_off_amount: writeOffAmt,
      write_off_reason: writeOffReasonOut,
      deposit_status: depositOutcome === "full" ? "refunded" : depositOutcome === "kept" ? "kept" : "partial",
      deposit_refund_amount: refundNum,
      deposit_refunded_at: refundNum > 0 ? endDate : null,
      notes: notes || null,
    };

    if (resolvedTenancyId) {
      const { error: tErr } = await supabase.from("tenancies").update(tenancyPayload).eq("id", resolvedTenancyId);
      if (tErr) { setSaving(false); return toast.error(tErr.message); }
    } else {
      const { data: ins, error: insErr } = await supabase.from("tenancies").insert({
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
      } as any).select("id").maybeSingle();
      if (insErr) { setSaving(false); return toast.error(insErr.message); }
      resolvedTenancyId = (ins as any)?.id || null;
    }

    // Write the settlement/write-off payment row AFTER the lease is closed so
    // it lands on the closed lease and not on any later active one.
    if (extraPaymentRow) {
      // Make sure the row points at the resolved tenancy id (in case we just inserted).
      extraPaymentRow.tenancy_id = resolvedTenancyId;
      const { error: pErr } = await supabase.from("payments").insert(extraPaymentRow);
      if (pErr) {
        setSaving(false);
        return toast.error(pErr.message);
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
      // units.status omitted — derived by DB trigger (will become 'vacant' once tenant cleared)
    } as any).eq("id", unit.id);
    setSaving(false);
    if (uErr) return toast.error(uErr.message);

    const resolutionLabelAr =
      debtResolution === "kept" ? "إبقاء كدين على المستأجر"
      : debtResolution === "collected" ? "تم التحصيل"
      : debtResolution === "written_off" ? "شطب الرصيد"
      : "بدون رصيد";
    const resolutionLabelEn =
      debtResolution === "kept" ? "Kept as tenant debt"
      : debtResolution === "collected" ? "Collected"
      : debtResolution === "written_off" ? "Written off"
      : "No balance";

    logActivity({
      entityType: "tenant",
      action: "ended",
      entityId: unit.id,
      entityLabel: unit.tenant_name || "",
      buildingId: unit.building_id,
      descriptionAr: `إنهاء ${contractNumber ? `العقد ${contractNumber}` : "عقد"} — ${unit.tenant_name || ""} — وحدة ${unit.unit_number}${hasOutstanding ? ` — ${resolutionLabelAr}` : ""}`,
      descriptionEn: `Ended ${contractNumber ? `lease ${contractNumber}` : "lease"} — ${unit.tenant_name || ""} — unit ${unit.unit_number}${hasOutstanding ? ` — ${resolutionLabelEn}` : ""}`,
      changes: {
        reason,
        ended_at: endDate,
        outstanding,
        closing_balance: closingBalance,
        debt_resolution: debtResolution,
        write_off_reason: writeOffReasonOut,
        deposit_refund: refundNum,
      },
    });
    // Broadcast so every screen drops the previous tenant's cached balance.
    const { paymentsBus } = await import("@/lib/paymentsBus");
    paymentsBus.emit(unit.id);
    toast.success(t2("tenancy_ended_ok"));
    guard.markSaved();
    onOpenChange(false);
    onDone();
  };

  if (!unit) return null;

  // === Resolution card (Midnight & Gold) =====================================
  const renderResolutionCard = () => {
    if (!hasOutstanding) {
      return (
        <div className="rounded-xl border border-sage-200/60 bg-sage-300/10 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{t2("outstanding_balance")}</span>
            <span className="text-base font-black text-sage-600">{format(0)}</span>
          </div>
        </div>
      );
    }

    const opt = (
      key: Resolution,
      icon: JSX.Element,
      title: string,
      desc: string,
      recommended?: boolean,
    ) => {
      const active = resolution === key;
      return (
        <button
          type="button"
          onClick={() => setResolution(key)}
          className={`w-full text-start rounded-2xl px-3.5 py-3 transition-all border-2 ${
            active
              ? "border-gold bg-gold/10 ring-2 ring-gold/30"
              : "border-white/10 bg-white/5 hover:bg-white/10"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`shrink-0 mt-0.5 rounded-full p-2 ${active ? "bg-gold/25 text-gold-bright" : "bg-white/10 text-white/70"}`}>
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-sm font-bold ${active ? "text-gold-bright" : "text-white"}`}>{title}</span>
                {recommended && (
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-gold/25 text-gold-bright px-1.5 py-0.5 rounded">
                    {ar ? "موصى به" : "Recommended"}
                  </span>
                )}
              </div>
              <p className="text-[11px] leading-relaxed text-white/65 mt-0.5">{desc}</p>
            </div>
          </div>
        </button>
      );
    };

    return (
      <div className="rounded-2xl p-4 bg-[#0e1118] border border-gold/25 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/55 font-semibold">
              {ar ? "رصيد مستحق على المستأجر" : "Outstanding balance"}
            </div>
            <div className="text-xs text-white/70 mt-1">
              {ar
                ? "اختر كيفية إغلاق هذا الرصيد قبل إنهاء العقد"
                : "Choose how to close this balance before ending the lease"}
            </div>
          </div>
          <div className="text-2xl font-black text-gold-bright tabular-nums">{format(outstanding)}</div>
        </div>

        <div className="space-y-2">
          {opt(
            "kept",
            <Wallet className="h-4 w-4" />,
            ar ? "إبقاء كدين على المستأجر" : "Keep as debt on tenant",
            ar
              ? "إغلاق العقد مع الإبقاء على الرصيد كذمّة سابقة. لن ينتقل إلى المستأجر الجديد ولا إلى رصيد الوحدة النشط."
              : "Close the lease and keep the balance as a previous-tenant receivable. It will not follow the unit or any new tenant.",
            true,
          )}
          {opt(
            "collected",
            <CheckCircle2 className="h-4 w-4" />,
            ar ? "تم التحصيل الآن" : "Mark as collected now",
            ar
              ? "تسجيل دفعة تسوية تُغلق الرصيد بالكامل، ثم إنهاء العقد برصيد صفر."
              : "Record a settlement payment that clears the balance, then close the lease at zero.",
          )}
          {opt(
            "written_off",
            <FileMinus2 className="h-4 w-4" />,
            ar ? "شطب الرصيد (تنازل/تسوية)" : "Write off (waiver / settlement)",
            ar
              ? "تصفير الرصيد عبر قيد محاسبي مُسجَّل مع سبب صريح. يظهر كشطب متعمّد لا كخسارة صامتة."
              : "Zero the balance via a logged adjustment with a required reason — recorded as a deliberate write-off.",
          )}
        </div>

        {resolution === "collected" && (
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label className="text-[10px] text-white/60 uppercase tracking-wider">
                  {ar ? "المبلغ المحصَّل" : "Collected amount"}
                </Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.001"
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(e.target.value)}
                  className="rounded-xl h-10 bg-[#1a1f2b] border-white/15 text-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-white/60 uppercase tracking-wider">
                  {ar ? "طريقة الدفع" : "Method"}
                </Label>
                <Select value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
                  <SelectTrigger className="rounded-xl h-10 bg-[#1a1f2b] border-white/15 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{ar ? "نقدًا" : "Cash"}</SelectItem>
                    <SelectItem value="transfer">{ar ? "تحويل" : "Transfer"}</SelectItem>
                    <SelectItem value="cheque">{ar ? "شيك" : "Cheque"}</SelectItem>
                    <SelectItem value="card">{ar ? "بطاقة" : "Card"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {collectAmountNum + 0.009 < outstanding && (
              <p className="text-[11px] text-[#e09a9a]">
                {ar
                  ? `المبلغ أقل من الرصيد المستحق (${format(outstanding)}). أكمل المبلغ أو اختر طريقة أخرى.`
                  : `Amount is less than outstanding (${format(outstanding)}). Increase it or choose another option.`}
              </p>
            )}
          </div>
        )}

        {resolution === "written_off" && (
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-1.5">
            <Label className="text-[10px] text-white/60 uppercase tracking-wider">
              {ar ? "سبب الشطب (إلزامي)" : "Write-off reason (required)"}
            </Label>
            <Textarea
              value={writeOffReason}
              onChange={(e) => setWriteOffReason(e.target.value)}
              rows={2}
              placeholder={ar ? "مثال: تنازل ودّي، تسوية قضائية، عدم القدرة على التواصل…" : "e.g. amicable waiver, settled out of court, unreachable…"}
              className="rounded-xl bg-[#1a1f2b] border-white/15 text-white placeholder:text-white/30"
            />
            {!writeOffReasonOk && writeOffReason.length > 0 && (
              <p className="text-[11px] text-[#e09a9a]">
                {ar ? "السبب قصير جدًا — اكتب ٤ أحرف على الأقل." : "Reason too short — write at least 4 characters."}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={guard.handleOpenChange}>
      <DialogContent className="rounded-2xl max-w-md md:max-w-xl lg:max-w-2xl max-h-[90vh] overflow-y-auto">
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
                  <SelectItem value="end_of_contract">{ar ? "نهاية العقد" : "End of contract"}</SelectItem>
                  <SelectItem value="tenant_left">{ar ? "انسحاب المستأجر" : "Tenant withdrew"}</SelectItem>
                  <SelectItem value="evicted">{ar ? "إخلاء قسري" : "Eviction"}</SelectItem>
                  <SelectItem value="other">{ar ? "أخرى" : "Other"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Outstanding resolution card */}
          {renderResolutionCard()}

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
          <Button data-guard-ignore onClick={submit} disabled={submitDisabled} className="rounded-xl bg-burgundy hover:bg-burgundy/90 text-primary-foreground">
            {t2("end_tenancy")}
          </Button>
        </DialogFooter>
        {guard.ConfirmDiscardUI}
      </DialogContent>
    </Dialog>
  );
}
