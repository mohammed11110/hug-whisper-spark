import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { useT2 } from "@/lib/i18n2";
import { useCurrency } from "@/lib/currency";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUnsavedGuard } from "@/lib/useUnsavedGuard";
import { getUnitArrears, type UnitForBalance, type PaymentForBalance } from "@/lib/balance";

const METHODS = ["cash", "transfer", "cheque", "card"] as const;

const AR_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const EN_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  paymentId: string | null;
  onSaved?: () => void;
}

export function EditPaymentDialog({ open, onOpenChange, paymentId, onSaved }: Props) {
  const t2 = useT2();
  const { lang } = useI18n();
  const { format } = useCurrency();
  const [amount, setAmount] = useState("");
  const [originalAmount, setOriginalAmount] = useState(0);
  const [expected, setExpected] = useState("");
  const [date, setDate] = useState("");
  const [receipt, setReceipt] = useState("");
  const [method, setMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [periodStart, setPeriodStart] = useState<string | null>(null);
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unitIdRef, setUnitIdRef] = useState<string | null>(null);
  const [unitData, setUnitData] = useState<UnitForBalance | null>(null);
  const [allPayments, setAllPayments] = useState<PaymentForBalance[]>([]);
  const guard = useUnsavedGuard({ open, onOpenChange });

  useEffect(() => {
    if (!open || !paymentId) return;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("amount, expected_amount, payment_date, receipt_number, payment_method, notes, period_start, period_end, unit_id")
        .eq("id", paymentId)
        .maybeSingle();
      if (error || !data) { setLoading(false); return; }
      setAmount(String(data.amount ?? ""));
      setOriginalAmount(Number(data.amount ?? 0));
      setExpected(String(data.expected_amount ?? ""));
      setDate(data.payment_date ?? "");
      setReceipt(data.receipt_number ?? "");
      setMethod(data.payment_method ?? "cash");
      setNotes(data.notes ?? "");
      setPeriodStart(data.period_start ?? null);
      setPeriodEnd(data.period_end ?? null);
      const uid = (data as any).unit_id ?? null;
      setUnitIdRef(uid);
      if (uid) {
        const [{ data: u }, { data: pays }] = await Promise.all([
          supabase.from("units").select("rent_amount, rent_type, due_day, rent_timing, contract_start_date, opening_balance, opening_balance_date").eq("id", uid).maybeSingle(),
          supabase.from("payments").select("id, amount, payment_date, period_start, period_end").eq("unit_id", uid).is("deleted_at", null),
        ]);
        if (u) setUnitData(u as any);
        setAllPayments((pays || []) as any);
      }
      setLoading(false);
    })();
  }, [open, paymentId]);

  // إعادة احتساب فورية: نستبدل دفعتنا الحالية بالمبلغ الجديد ونحسب المتأخرات.
  const arrearsPreview = useMemo(() => {
    if (!unitData) return null;
    const newAmount = Number(amount) || 0;
    const adjusted = allPayments.map((p) =>
      p.id === paymentId ? { ...p, amount: newAmount } : p,
    );
    return getUnitArrears(unitData, adjusted, new Date(), lang as "ar" | "en");
  }, [unitData, allPayments, amount, paymentId, lang]);

  const arrearsCurrent = useMemo(() => {
    if (!unitData) return null;
    return getUnitArrears(unitData, allPayments, new Date(), lang as "ar" | "en");
  }, [unitData, allPayments, lang]);

  const diff = useMemo(() => {
    if (!arrearsPreview || !arrearsCurrent) return 0;
    return arrearsPreview.totalShortfall - arrearsCurrent.totalShortfall;
  }, [arrearsPreview, arrearsCurrent]);

  const periodLabel = (() => {
    if (!periodStart) return lang === "ar" ? "— (دفعة بدون فترة)" : "— (no period)";
    const d = new Date(periodStart);
    const names = lang === "ar" ? AR_MONTHS : EN_MONTHS;
    if (d.getDate() === 1) return `${names[d.getMonth()]} ${d.getFullYear()}`;
    const fmt = (s: string) => {
      const x = new Date(s);
      return `${x.getDate()}/${x.getMonth() + 1}/${x.getFullYear()}`;
    };
    return periodEnd
      ? (lang === "ar" ? `${fmt(periodStart)} → ${fmt(periodEnd)}` : `${fmt(periodStart)} – ${fmt(periodEnd)}`)
      : fmt(periodStart);
  })();

  const submit = async () => {
    if (!paymentId) return;
    const a = Number(amount);
    if (!a || a <= 0) return toast.error(lang === "ar" ? "أدخل مبلغاً صحيحاً" : "Invalid amount");
    setSaving(true);
    // فترة الدفعة (period_start/period_end) لا تُعدَّل من هنا — تظل مرتبطة
    // بالدورة الأصلية. لنقل دفعة لدورة أخرى احذفها وأعد تسجيلها.
    const { error } = await supabase.from("payments").update({
      amount: a,
      expected_amount: Number(expected) || null,
      payment_date: date,
      receipt_number: receipt.trim() || null,
      payment_method: method,
      notes: notes.trim() || null,
    }).eq("id", paymentId);
    setSaving(false);
    if (error) return toast.error(error.message);

    if (unitIdRef) {
      const { data: latest } = await supabase
        .from("payments")
        .select("payment_date")
        .eq("unit_id", unitIdRef)
        .is("deleted_at", null)
        .order("payment_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latest?.payment_date) {
        await supabase.from("units").update({ last_paid_date: latest.payment_date }).eq("id", unitIdRef);
      }
    }

    toast.success("✓");
    guard.markSaved();
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={guard.handleOpenChange}>
      <DialogContent className="rounded-2xl max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sage-600">{lang === "ar" ? "تعديل الدفعة" : "Edit payment"}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-center text-sage-500 py-8">…</p>
        ) : (
          <div className="space-y-3" {...guard.formProps}>
            {/* فترة الدفعة كقراءة-فقط: لا يمكن نقل دفعة من دورة لأخرى */}
            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500">{t2("rent_month")}</Label>
              <div className="rounded-xl border border-dashed border-sage-200 bg-sage-100/30 px-3 py-2.5">
                <p className="text-sm font-bold text-sage-700">{periodLabel}</p>
                <p className="text-[10px] text-sage-400 mt-0.5 leading-relaxed">
                  {lang === "ar"
                    ? "لا يمكن تغيير الفترة. لنقل الدفعة لدورة أخرى، احذفها وأعد تسجيلها."
                    : "Period cannot be changed. To move a payment, delete and re-record it."}
                </p>
              </div>
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
                    {METHODS.map((m) => <SelectItem key={m} value={m}>{methodLabel(m, lang)}</SelectItem>)}
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
        )}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button data-guard-ignore variant="outline" onClick={() => guard.handleOpenChange(false)} className="rounded-xl">{t2("cancel")}</Button>
          <Button data-guard-ignore onClick={submit} disabled={saving || loading} className="rounded-xl bg-gradient-sage text-primary-foreground">{t2("save")}</Button>
        </DialogFooter>
        {guard.ConfirmDiscardUI}
      </DialogContent>
    </Dialog>
  );
}

function methodLabel(m: string, lang: string) {
  const ar: Record<string, string> = { cash: "نقدي", transfer: "تحويل", cheque: "شيك", card: "بطاقة" };
  const en: Record<string, string> = { cash: "Cash", transfer: "Transfer", cheque: "Cheque", card: "Card" };
  return (lang === "ar" ? ar : en)[m] || m;
}
