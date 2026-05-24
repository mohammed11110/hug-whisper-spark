import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";

const AR_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const EN_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export interface MonthOpt { label: string; value: string; start: string; end: string; }

export function getLastPaidMonthOptions(lang: string, monthsBack = 24): MonthOpt[] {
  const names = lang === "ar" ? AR_MONTHS : EN_MONTHS;
  const opts: MonthOpt[] = [];
  const today = new Date();
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const lastDay = new Date(y, m + 1, 0).getDate();
    opts.push({
      label: `${names[m]} ${y}`,
      value: `${y}-${String(m + 1).padStart(2, "0")}`,
      start: `${y}-${String(m + 1).padStart(2, "0")}-01`,
      end: `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    });
  }
  return opts;
}

/** First day of the month AFTER the given YYYY-MM. */
export function nextMonthStartISO(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  const d = new Date(y, m, 1); // m is 0-indexed in Date, but m here is 1-indexed → next month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

interface Props {
  enabled: boolean;
  onEnabledChange: (b: boolean) => void;
  month: string;
  onMonthChange: (v: string) => void;
  amount: string;
  onAmountChange: (v: string) => void;
}

export function LastPaymentSection({ enabled, onEnabledChange, month, onMonthChange, amount, onAmountChange }: Props) {
  const { lang } = useI18n();
  const opts = useMemo(() => getLastPaidMonthOptions(lang), [lang]);
  const selected = opts.find((o) => o.value === month);
  const nextMonthLabel = selected ? (() => {
    const [y, m] = selected.value.split("-").map(Number);
    const next = new Date(y, m, 1);
    const names = lang === "ar" ? AR_MONTHS : EN_MONTHS;
    return `${names[next.getMonth()]} ${next.getFullYear()}`;
  })() : null;

  return (
    <div className="pt-2 border-t border-sage-100">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          className="h-4 w-4 accent-sage-500"
        />
        <span className="text-xs font-semibold text-sage-600">
          {lang === "ar" ? "المستأجر دفع إيجار شهور سابقة" : "Tenant has paid previous months"}
        </span>
      </label>
      {enabled && (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-sage-600 font-semibold">
                {lang === "ar" ? "آخر شهر مدفوع عنه" : "Last month paid for"}
              </Label>
              <Select value={month} onValueChange={onMonthChange}>
                <SelectTrigger className="rounded-xl border-sage-200 bg-card h-10"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-sage-600 font-semibold">
                {lang === "ar" ? "المبلغ المدفوع" : "Amount paid"}
              </Label>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.001"
                value={amount}
                onChange={(e) => onAmountChange(e.target.value)}
                className="rounded-xl border-sage-200 bg-card h-10"
              />
            </div>
          </div>
          {nextMonthLabel && (
            <p className="text-[11px] text-muted-foreground bg-sage-50 rounded-lg px-2 py-1.5 border border-sage-200/60">
              {lang === "ar"
                ? `ⓘ المتأخرات ستُحسب تلقائياً من ${nextMonthLabel}`
                : `ⓘ Arrears will be calculated automatically from ${nextMonthLabel}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
