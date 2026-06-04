import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { logActivity } from "@/lib/activityLogger";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  unitId: string;
  unitNumber?: string | null;
  buildingId?: string | null;
  tenantName?: string | null;
  /** Current outstanding balance: >0 arrears, <0 credit, 0 settled. */
  currentBalance?: number;
  /** Formatter for currency amounts (optional). */
  formatAmount?: (n: number) => string;
}

type Direction = "increase" | "decrease";

/**
 * Manual balance adjustment — adds a transparent, logged entry in `payments`
 * with kind='adjustment'. Never deletes history.
 *
 *   • direction = "decrease" → signed positive amount → reduces arrears /
 *                              increases credit (was "waiver/discount").
 *   • direction = "increase" → signed negative amount → adds to arrears /
 *                              reduces credit (was "extra charge").
 *
 * Storage convention: amount is signed (+ for decrease, − for increase) so it
 * sums directly into totalPaid in calculateUnitBalance.
 */
export function AdjustBalanceDialog({
  open, onOpenChange, unitId, unitNumber, buildingId, tenantName,
  currentBalance, formatAmount,
}: Props) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [direction, setDirection] = useState<Direction>("decrease");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => { setDirection("decrease"); setAmount(""); setNotes(""); };

  const fmt = (n: number) => formatAmount ? formatAmount(n) : n.toFixed(3);

  // Describe a balance value in plain language with a color token class.
  const describe = (v: number) => {
    if (Math.abs(v) < 0.005) return { label: ar ? "مسدّد" : "Settled", cls: "text-sage-600" };
    if (v > 0) return { label: ar ? "متأخرات" : "Arrears", cls: "text-terracotta" };
    return { label: ar ? "رصيد دائن" : "Credit", cls: "text-sage-700" };
  };

  const parsedAmount = parseFloat(amount);
  const validAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;

  const preview = useMemo(() => {
    if (currentBalance == null) return null;
    const delta = validAmount ? parsedAmount : 0;
    const next = direction === "decrease" ? currentBalance - delta : currentBalance + delta;
    return {
      now: { v: currentBalance, ...describe(currentBalance) },
      after: { v: next, ...describe(next) },
    };
  }, [currentBalance, parsedAmount, direction, validAmount, ar]);

  // Adaptive title based on current balance state.
  const title = useMemo(() => {
    if (currentBalance == null || Math.abs(currentBalance) < 0.005) {
      return ar ? "تعديل الرصيد" : "Adjust balance";
    }
    if (currentBalance > 0) return ar ? "تعديل المتأخرات" : "Adjust arrears";
    return ar ? "تعديل الرصيد الدائن" : "Adjust credit balance";
  }, [currentBalance, ar]);

  // Per-direction hint depending on current balance state.
  const directionHint = (d: Direction): string => {
    const inArrears = (currentBalance ?? 0) > 0.005;
    const inCredit = (currentBalance ?? 0) < -0.005;
    if (d === "decrease") {
      if (inArrears) return ar ? "يُنقِص المتأخرات على المستأجر." : "Reduces tenant's arrears.";
      if (inCredit)  return ar ? "يَزيد الرصيد الدائن للمستأجر." : "Increases the tenant's credit.";
      return ar ? "يُنشئ رصيداً دائناً للمستأجر." : "Creates a credit for the tenant.";
    }
    if (inArrears) return ar ? "يَزيد المتأخرات على المستأجر." : "Increases tenant's arrears.";
    if (inCredit)  return ar ? "يُنقِص الرصيد الدائن للمستأجر." : "Reduces the tenant's credit.";
    return ar ? "يُضيف مستحقاً على المستأجر." : "Adds a charge on the tenant.";
  };

  const submit = async () => {
    if (!validAmount) {
      return toast.error(ar ? "أدخل مبلغاً صحيحاً" : "Enter a valid amount");
    }
    setBusy(true);
    // decrease balance = positive signed amount; increase balance = negative.
    const signed = direction === "decrease" ? parsedAmount : -parsedAmount;
    const today = new Date().toISOString().slice(0, 10);
    const reason = (notes || "").trim();
    const tag = direction === "decrease"
      ? (ar ? "إنقاص الرصيد" : "Decrease balance")
      : (ar ? "زيادة الرصيد" : "Increase balance");

    const { error } = await supabase.from("payments").insert({
      unit_id: unitId,
      amount: signed,
      payment_date: today,
      payment_method: "adjustment",
      kind: "adjustment",
      notes: reason ? `${tag} — ${reason}` : tag,
      period_start: today,
      period_end: today,
    } as any);
    if (error) { setBusy(false); return toast.error(error.message); }
    const { paymentsBus } = await import("@/lib/paymentsBus");
    paymentsBus.emit(unitId);

    logActivity({
      entityType: "payment",
      action: "updated",
      entityId: unitId,
      entityLabel: tenantName || unitNumber || "—",
      buildingId: buildingId ?? null,
      descriptionAr: `${tag} للوحدة ${unitNumber || ""} بقيمة ${Math.abs(signed)}${reason ? ` — ${reason}` : ""}`,
      descriptionEn: `${tag} on unit ${unitNumber || ""} of ${Math.abs(signed)}${reason ? ` — ${reason}` : ""}`,
    });




    toast.success(ar ? "تم تعديل الرصيد" : "Balance adjusted");
    setBusy(false);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md md:max-w-xl lg:max-w-2xl rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-base font-black text-sage-700">{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            {ar
              ? "أضف قيداً شفافاً يُسجَّل في السجل المالي. لا يُعدّل ولا يُحذف الإيصالات السابقة."
              : "Adds a transparent, logged entry. Existing receipts are never modified."}
          </p>

          <div>
            <Label className="text-[11px] font-bold text-sage-600 mb-1.5 block">
              {ar ? "نوع التعديل" : "Adjustment"}
            </Label>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setDirection("decrease")}
                className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                  direction === "decrease"
                    ? "bg-sage-100 text-sage-700 border-2 border-sage-300"
                    : "bg-muted text-muted-foreground border-2 border-transparent"
                }`}
              >
                <span className="text-base leading-none">−</span>
                <span>{ar ? "إنقاص الرصيد" : "Decrease"}</span>
              </button>
              <button
                type="button"
                onClick={() => setDirection("increase")}
                className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                  direction === "increase"
                    ? "bg-terracotta/10 text-terracotta border-2 border-terracotta/30"
                    : "bg-muted text-muted-foreground border-2 border-transparent"
                }`}
              >
                <span className="text-base leading-none">+</span>
                <span>{ar ? "زيادة الرصيد" : "Increase"}</span>
              </button>
            </div>
            <p className="text-[11px] text-sage-500 mt-1.5 leading-relaxed">
              {directionHint(direction)}
            </p>
          </div>

          <div>
            <Label className="text-[11px] font-bold text-sage-600 mb-1.5 block">
              {ar ? "المبلغ" : "Amount"}
            </Label>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.000"
              className="rounded-xl border-sage-200 bg-card text-base font-bold"
            />

            {preview && (
              <div className="mt-2 rounded-xl bg-sage-50 border border-sage-200/60 p-2.5 text-[11px] leading-relaxed">
                <div className="flex items-center justify-between">
                  <span className="text-sage-500">{ar ? "الرصيد الحالي" : "Current"}</span>
                  <span className={`font-bold ${preview.now.cls}`}>
                    {fmt(Math.abs(preview.now.v))}{" "}
                    <span className="text-[10px] opacity-75">({preview.now.label})</span>
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sage-500">{ar ? "بعد التعديل" : "After"}</span>
                  <span className={`font-bold ${preview.after.cls}`}>
                    {fmt(Math.abs(preview.after.v))}{" "}
                    <span className="text-[10px] opacity-75">({preview.after.label})</span>
                  </span>
                </div>
              </div>
            )}
          </div>

          <div>
            <Label className="text-[11px] font-bold text-sage-600 mb-1.5 block">
              {ar ? "السبب (اختياري)" : "Reason (optional)"}
            </Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={ar ? "مثال: خصم لظروف خاصة" : "e.g. discount for special circumstances"}
              className="rounded-xl border-sage-200 bg-card"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 rounded-xl border-sage-300 h-11"
              disabled={busy}
            >
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={submit}
              disabled={busy}
              className="flex-1 rounded-xl bg-gradient-sage text-primary-foreground h-11 font-bold"
            >
              {busy ? "…" : (ar ? "تأكيد التعديل" : "Confirm")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
