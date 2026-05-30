import { useState } from "react";
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
}

/**
 * Manual balance adjustment — adds a transparent, logged entry in `payments`
 * with kind='adjustment'. Never deletes history.
 *   • direction = "waiver"  → reduces tenant's balance (e.g. discount / forgiveness)
 *   • direction = "charge"  → adds to tenant's balance (e.g. extra fee)
 * Storage convention: amount is signed (+ waiver, − charge) so it sums
 * directly into totalPaid in calculateUnitBalance.
 */
export function AdjustBalanceDialog({
  open, onOpenChange, unitId, unitNumber, buildingId, tenantName,
}: Props) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [direction, setDirection] = useState<"waiver" | "charge">("waiver");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => { setDirection("waiver"); setAmount(""); setNotes(""); };

  const submit = async () => {
    const raw = parseFloat(amount);
    if (!Number.isFinite(raw) || raw <= 0) {
      return toast.error(ar ? "أدخل مبلغاً صحيحاً" : "Enter a valid amount");
    }
    setBusy(true);
    const signed = direction === "waiver" ? raw : -raw;
    const today = new Date().toISOString().slice(0, 10);
    const reason = (notes || "").trim();
    const tag = direction === "waiver"
      ? (ar ? "تخفيض/إعفاء" : "Waiver/Discount")
      : (ar ? "رسوم إضافية" : "Extra charge");
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

    logActivity({
      entityType: "payment",
      action: "updated",
      entityId: unitId,
      entityLabel: tenantName || unitNumber || "—",
      buildingId: buildingId ?? null,
      descriptionAr: `${tag} للوحدة ${unitNumber || ""} بقيمة ${Math.abs(signed)}${reason ? ` — ${reason}` : ""}`,
      descriptionEn: `${tag} on unit ${unitNumber || ""} of ${Math.abs(signed)}${reason ? ` — ${reason}` : ""}`,
    });

    const { paymentsBus } = await import("@/lib/paymentsBus");
    paymentsBus.emit(unitId);

    toast.success(ar ? "تم تعديل الرصيد" : "Balance adjusted");
    setBusy(false);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-base font-black text-sage-700">
            {ar ? "تعديل الرصيد يدوياً" : "Adjust Balance"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            {ar
              ? "أضف قيداً شفافاً يُسجَّل في السجل المالي. لا يُعدّل ولا يُحذف الإيصالات السابقة."
              : "Adds a transparent, logged entry. Does not modify or delete existing receipts."}
          </p>

          <div>
            <Label className="text-[11px] font-bold text-sage-600 mb-1.5 block">
              {ar ? "نوع التعديل" : "Adjustment type"}
            </Label>
            <div className="flex gap-1.5">
              {([
                { v: "waiver", ar: "تخفيض / إعفاء", en: "Waiver / Discount" },
                { v: "charge", ar: "رسوم إضافية", en: "Extra charge" },
              ] as const).map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setDirection(o.v)}
                  className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                    direction === o.v
                      ? (o.v === "waiver"
                          ? "bg-sage-100 text-sage-700 border-2 border-sage-300"
                          : "bg-terracotta/10 text-terracotta border-2 border-terracotta/30")
                      : "bg-muted text-muted-foreground border-2 border-transparent"
                  }`}
                >
                  {ar ? o.ar : o.en}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-sage-500 mt-1.5 leading-relaxed">
              {direction === "waiver"
                ? (ar ? "يُخفِّض المتأخرات الظاهرة على المستأجر." : "Reduces the tenant's displayed arrears.")
                : (ar ? "يُضاف إلى رصيد المستأجر كرسوم إضافية." : "Adds to the tenant's balance as an extra fee.")}
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
              {busy ? (ar ? "..." : "...") : (ar ? "تأكيد التعديل" : "Confirm")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
