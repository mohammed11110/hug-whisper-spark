import { useEffect } from "react";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { CalendarIcon, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { cyclesDue } from "@/lib/balance";

const AR_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const EN_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const addDaysISO = (d: Date, days: number) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
  return iso(x);
};

const monthLabel = (d: Date, lang: string) => {
  const M = lang === "ar" ? AR_MONTHS : EN_MONTHS;
  return `${M[d.getMonth()]} ${d.getFullYear()}`;
};

export interface MonthBounds {
  start: string;
  end: string;
  startLabel: string;
  nextMonthStart: string;
  nextMonthLabel: string;
}

export function monthBoundsFromDate(date: Date, lang = "en"): MonthBounds {
  const y = date.getFullYear();
  const m = date.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  const next = new Date(y, m + 1, 1);
  const names = lang === "ar" ? AR_MONTHS : EN_MONTHS;
  return {
    start: `${y}-${String(m + 1).padStart(2, "0")}-01`,
    end:   `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    startLabel: `${names[m]} ${y}`,
    nextMonthStart: iso(new Date(next.getFullYear(), next.getMonth(), 1)),
    nextMonthLabel: `${names[next.getMonth()]} ${next.getFullYear()}`,
  };
}

/** Build the anchor (= first unpaid cycle start) from periodTo. */
export function anchorFromPeriodTo(periodTo: Date): string {
  return addDaysISO(periodTo, 1);
}

interface Props {
  enabled: boolean;
  onEnabledChange: (b: boolean) => void;
  date: Date | undefined;
  onDateChange: (d: Date | undefined) => void;
  amount: string;
  onAmountChange: (v: string) => void;
  periodFrom: Date | undefined;
  periodTo: Date | undefined;
  onPeriodFromChange: (d: Date | undefined) => void;
  onPeriodToChange: (d: Date | undefined) => void;
  rentTiming?: "advance" | "arrears";
  rentAmount?: number;
}

export function LastPaymentSection({
  enabled, onEnabledChange,
  date, onDateChange,
  amount, onAmountChange,
  periodFrom, periodTo, onPeriodFromChange, onPeriodToChange,
  rentTiming = "advance",
  rentAmount = 0,
}: Props) {
  const { lang } = useI18n();
  const locale = lang === "ar" ? ar : enUS;

  // Auto-fill period range when payment date or timing changes.
  useEffect(() => {
    if (!enabled || !date) return;
    const b = monthBoundsFromDate(date, lang);
    if (rentTiming === "arrears") {
      // Payment covers the PREVIOUS month.
      const prev = new Date(date.getFullYear(), date.getMonth() - 1, 1);
      const pb = monthBoundsFromDate(prev, lang);
      onPeriodFromChange(new Date(pb.start + "T00:00:00"));
      onPeriodToChange(new Date(pb.end + "T00:00:00"));
    } else {
      // Advance: payment covers the SAME month.
      onPeriodFromChange(new Date(b.start + "T00:00:00"));
      onPeriodToChange(new Date(b.end + "T00:00:00"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, rentTiming, enabled]);

  // Live arrears preview.
  let preview: { kind: "due" | "ok"; cycles: number; total: number; nextMonth: string } | null = null;
  if (enabled && periodTo && rentAmount > 0) {
    const anchor = anchorFromPeriodTo(periodTo);
    const due = cyclesDue(
      {
        id: "_preview_",
        rent_amount: rentAmount,
        rent_type: "monthly",
        rent_timing: rentTiming,
        opening_balance_date: anchor,
      },
      new Date(),
    );
    const nextMonthDate = new Date(periodTo.getFullYear(), periodTo.getMonth() + 1, 1);
    preview = {
      kind: due > 0 ? "due" : "ok",
      cycles: due,
      total: due * rentAmount,
      nextMonth: monthLabel(nextMonthDate, lang),
    };
  }

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
      <p className="text-[10px] text-sage-400 mt-1 leading-relaxed">
        ⓘ {lang === "ar"
          ? "يُحدَّث تلقائياً عند تسجيل إيصال استلام جديد"
          : "Updates automatically when a payment receipt is recorded"}
      </p>

      {enabled && (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-sage-600 font-semibold">
                {lang === "ar" ? "تاريخ آخر دفعة" : "Last payment date"}
              </Label>
              <DateField date={date} onChange={onDateChange} locale={locale} lang={lang} disableFuture />
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

          <div className="rounded-xl border border-sage-200/70 bg-sage-50/40 p-2 space-y-2">
            <p className="text-[11px] font-bold text-sage-600">
              {lang === "ar" ? "الفترة المُغطّاة بهذه الدفعة" : "Period covered by this payment"}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-sage-500 font-semibold">
                  {lang === "ar" ? "من" : "From"}
                </Label>
                <DateField date={periodFrom} onChange={onPeriodFromChange} locale={locale} lang={lang} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-sage-500 font-semibold">
                  {lang === "ar" ? "إلى" : "To"}
                </Label>
                <DateField date={periodTo} onChange={onPeriodToChange} locale={locale} lang={lang} />
              </div>
            </div>
          </div>

          {preview && preview.kind === "due" && (
            <div className="flex items-start gap-2 rounded-xl border border-burgundy/30 bg-burgundy/5 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-burgundy mt-0.5 shrink-0" />
              <p className="text-[11px] text-burgundy font-semibold leading-relaxed">
                {lang === "ar"
                  ? `سيظهر متأخّرات لـ ${preview.cycles} ${preview.cycles === 1 ? "شهر" : preview.cycles === 2 ? "شهرين" : "أشهر"} بقيمة ${preview.total.toFixed(3)} ر.ع — تبدأ من ${preview.nextMonth}`
                  : `Will show ${preview.cycles} overdue ${preview.cycles === 1 ? "month" : "months"} (${preview.total.toFixed(3)} OMR) — starting ${preview.nextMonth}`}
              </p>
            </div>
          )}
          {preview && preview.kind === "ok" && periodTo && (
            <div className="flex items-start gap-2 rounded-xl border border-sage-300/50 bg-sage-100/40 px-3 py-2">
              <CheckCircle2 className="h-4 w-4 text-sage-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-sage-700 font-semibold leading-relaxed">
                {lang === "ar"
                  ? `الحساب مُسوّى حتى ${monthLabel(periodTo, lang)} — لا متأخّرات حتى الآن`
                  : `Settled through ${monthLabel(periodTo, lang)} — no arrears yet`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DateField({
  date, onChange, locale, lang, disableFuture,
}: {
  date: Date | undefined;
  onChange: (d: Date | undefined) => void;
  locale: any;
  lang: string;
  disableFuture?: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full h-10 rounded-xl border-sage-200 bg-card justify-start text-start font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="h-4 w-4 me-2 opacity-60" />
          {date
            ? format(date, "PPP", { locale })
            : (lang === "ar" ? "اختر التاريخ" : "Pick a date")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onChange}
          disabled={disableFuture ? (d) => d > new Date() : undefined}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}
