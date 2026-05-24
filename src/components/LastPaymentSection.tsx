import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

const AR_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const EN_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export interface MonthBounds {
  start: string;            // first day of date's month (YYYY-MM-DD)
  end: string;              // last day of date's month
  nextMonthStart: string;   // first day of the month AFTER date's month
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
    nextMonthStart: iso(new Date(next.getFullYear(), next.getMonth(), 1)),
    nextMonthLabel: `${names[next.getMonth()]} ${next.getFullYear()}`,
  };
}

interface Props {
  enabled: boolean;
  onEnabledChange: (b: boolean) => void;
  date: Date | undefined;
  onDateChange: (d: Date | undefined) => void;
  amount: string;
  onAmountChange: (v: string) => void;
}

export function LastPaymentSection({ enabled, onEnabledChange, date, onDateChange, amount, onAmountChange }: Props) {
  const { lang } = useI18n();
  const locale = lang === "ar" ? ar : enUS;
  const bounds = date ? monthBoundsFromDate(date, lang) : null;

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
                {lang === "ar" ? "تاريخ آخر دفعة" : "Last payment date"}
              </Label>
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
                    onSelect={onDateChange}
                    disabled={(d) => d > new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
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
          {bounds && (
            <p className="text-[11px] text-muted-foreground bg-sage-50 rounded-lg px-2 py-1.5 border border-sage-200/60">
              {lang === "ar"
                ? `ⓘ المتأخرات ستُحسب تلقائياً من ${bounds.nextMonthLabel}`
                : `ⓘ Arrears will be calculated automatically from ${bounds.nextMonthLabel}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
