import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { useT2 } from "@/lib/i18n2";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUnsavedGuard } from "@/lib/useUnsavedGuard";

const METHODS = ["cash", "transfer", "cheque", "card"] as const;

const AR_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const EN_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthRange(year: number, month1to12: number) {
  const y = year, m = month1to12 - 1;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const end = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

function yearOptions() {
  const cur = new Date().getFullYear();
  const out: number[] = [];
  for (let y = cur + 2; y >= 2020; y--) out.push(y);
  return out;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  paymentId: string | null;
  onSaved?: () => void;
}

export function EditPaymentDialog({ open, onOpenChange, paymentId, onSaved }: Props) {
  const t2 = useT2();
  const { lang } = useI18n();
  const [amount, setAmount] = useState("");
  const [expected, setExpected] = useState("");
  const [date, setDate] = useState("");
  const [receipt, setReceipt] = useState("");
  const [method, setMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [periodYear, setPeriodYear] = useState<number>(() => new Date().getFullYear());
  const [periodMonthNum, setPeriodMonthNum] = useState<number>(() => new Date().getMonth() + 1);
  const [hasPeriod, setHasPeriod] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paidMonthsKeys, setPaidMonthsKeys] = useState<Set<string>>(new Set());
  const guard = useUnsavedGuard({ open, onOpenChange });

  const { start: periodStart, end: periodEnd } = monthRange(periodYear, periodMonthNum);
  const monthNames = lang === "ar" ? AR_MONTHS : EN_MONTHS;

  useEffect(() => {
    if (!open || !paymentId) return;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("amount, expected_amount, payment_date, receipt_number, payment_method, notes, period_start, period_end, unit_id")
        .eq("id", paymentId)
        .maybeSingle();
      setLoading(false);
      if (error || !data) return;
      setAmount(String(data.amount ?? ""));
      setExpected(String(data.expected_amount ?? ""));
      setDate(data.payment_date ?? "");
      setReceipt(data.receipt_number ?? "");
      setMethod(data.payment_method ?? "cash");
      setNotes(data.notes ?? "");
      const ref = data.period_start || data.payment_date;
      if (ref) {
        setPeriodYear(Number(ref.slice(0, 4)));
        setPeriodMonthNum(Number(ref.slice(5, 7)));
      }
      setHasPeriod(true);

      // Load fully-paid months for this unit (excluding the payment being edited)
      const unitId = (data as any).unit_id;
      if (unitId) {
        const [{ data: tn }, { data: ps }] = await Promise.all([
          supabase.from("tenancies").select("rent_amount").eq("unit_id", unitId).eq("status", "active").maybeSingle(),
          supabase.from("payments").select("id, amount, period_start").eq("unit_id", unitId).is("deleted_at", null),
        ]);
        const rentAmt = Number((tn as any)?.rent_amount) || 0;
        const byMonth = new Map<string, number>();
        (ps || []).forEach((p: any) => {
          if (!p.period_start || p.id === paymentId) return;
          const k = String(p.period_start).slice(0, 7);
          byMonth.set(k, (byMonth.get(k) || 0) + Number(p.amount));
        });
        const fullyPaid = new Set<string>();
        byMonth.forEach((paid, k) => {
          if (rentAmt > 0 ? paid + 0.01 >= rentAmt : paid > 0) fullyPaid.add(k);
        });
        setPaidMonthsKeys(fullyPaid);
      }
    })();
  }, [open, paymentId]);

  const submit = async () => {
    if (!paymentId) return;
    const a = Number(amount);
    if (!a || a <= 0) return toast.error(lang === "ar" ? "أدخل مبلغاً صحيحاً" : "Invalid amount");
    setSaving(true);
    const { error } = await supabase.from("payments").update({
      amount: a,
      expected_amount: Number(expected) || null,
      payment_date: date,
      receipt_number: receipt.trim() || null,
      payment_method: method,
      notes: notes.trim() || null,
      period_start: periodStart || null,
      period_end: periodEnd || null,
    }).eq("id", paymentId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("✓");
    guard.markSaved();
    onOpenChange(false);
    onSaved?.();
  };

  const years = yearOptions();

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
            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500">{t2("rent_month")}</Label>
              {(() => {
                const paidInYear = monthNames
                  .map((_, i) => i + 1)
                  .filter((m) => paidMonthsKeys.has(`${periodYear}-${String(m).padStart(2, "0")}`) && m !== periodMonthNum);
                return (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={String(periodMonthNum)} onValueChange={(v) => setPeriodMonthNum(Number(v))}>
                        <SelectTrigger className="rounded-xl border-sage-200 bg-card h-11"><SelectValue /></SelectTrigger>
                        <SelectContent className="max-h-72">
                          {monthNames.map((n, i) => {
                            const k = `${periodYear}-${String(i + 1).padStart(2, "0")}`;
                            const isPaid = paidMonthsKeys.has(k) && (i + 1) !== periodMonthNum;
                            if (isPaid) return null;
                            return <SelectItem key={i} value={String(i + 1)}>{n}</SelectItem>;
                          })}
                        </SelectContent>
                      </Select>
                      <Select value={String(periodYear)} onValueChange={(v) => setPeriodYear(Number(v))}>
                        <SelectTrigger className="rounded-xl border-sage-200 bg-card h-11"><SelectValue /></SelectTrigger>
                        <SelectContent className="max-h-72">
                          {years.map((y) => (
                            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {paidInYear.length > 0 && (
                      <div className="mt-1.5 text-[11px] text-sage-400">
                        {lang === "ar"
                          ? `تم إخفاء ${paidInYear.length} ${paidInYear.length === 1 ? "شهر مسدَّد" : "أشهر مسدَّدة"}`
                          : `${paidInYear.length} paid ${paidInYear.length === 1 ? "month" : "months"} hidden`}
                      </div>
                    )}
                  </>
                );
              })()}
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
