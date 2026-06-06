import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import {
  parseLocalDate,
  getCycleByStartMonth,
  getUnitArrears,
  getNextDueInfo,
  periodsElapsed,
  type UnitForBalance,
} from "@/lib/balance";

export type BackdatedResolution =
  | { kind: "all_paid"; paidUpTo: string; openingBalance: 0; openingBalanceDate: null }
  | { kind: "some_unpaid"; paidUpTo: string; arrearsStartDate: string; firstUnpaidIndex: number; openingBalance: 0; openingBalanceDate: null }
  | { kind: "manual"; openingBalance: number; openingBalanceDate: string; paidUpTo: string };

interface Props {
  contractStartDate: string; // ISO YYYY-MM-DD
  contractEndDate?: string;  // ISO YYYY-MM-DD (optional)
  rentAmount: number;
  rentType: string;
  rentTiming: "advance" | "arrears";
  dueDay: number;
  onResolved: (r: BackdatedResolution | null) => void;
}

const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

const fmtDMY = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;

const fmtPeriod = (s: Date, e: Date) =>
  s.getFullYear() === e.getFullYear()
    ? `${s.getDate()}/${s.getMonth() + 1} – ${e.getDate()}/${e.getMonth() + 1}/${e.getFullYear()}`
    : `${fmtDMY(s)} – ${fmtDMY(e)}`;

interface Period {
  index: number;
  start: Date;
  end: Date;
  startIso: string;
}

/**
 * MANDATORY backdated-contract handler. Shown only when contract_start_date
 * is strictly before today.
 */
export function BackdatedContractCard({
  contractStartDate,
  contractEndDate,
  rentAmount,
  rentType,
  rentTiming,
  dueDay,
  onResolved,
}: Props) {
  const { lang } = useI18n();
  const ar = lang === "ar";

  const [choice, setChoice] = useState<"" | "all_paid" | "some_unpaid" | "manual">("");
  const [firstUnpaidIndex, setFirstUnpaidIndex] = useState<number | null>(null);
  const [manualAmount, setManualAmount] = useState<string>("");

  const anchorDay = Math.min(28, Math.max(1, Math.floor(dueDay || 1)));
  const startDate = parseLocalDate(contractStartDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Reset when contract_start_date changes.
  useEffect(() => {
    setChoice("");
    setManualAmount("");
    setFirstUnpaidIndex(null);
  }, [contractStartDate]);

  // Generate the real contract billing periods anchored on the start DAY.
  const periods = useMemo<Period[]>(() => {
    if (!startDate) return [];
    const endCap = (() => {
      const ce = contractEndDate ? parseLocalDate(contractEndDate) : null;
      if (ce && ce < today) return ce;
      return today;
    })();
    const list: Period[] = [];
    let cur = new Date(startDate);
    let idx = 1;
    while (cur <= endCap && idx <= 360) {
      const next = new Date(cur);
      if (rentType === "yearly") next.setFullYear(next.getFullYear() + 1);
      else if (rentType === "daily") next.setDate(next.getDate() + 1);
      else next.setMonth(next.getMonth() + 1);
      const end = addDays(next, -1);
      list.push({ index: idx, start: new Date(cur), end, startIso: isoOf(cur) });
      cur = next;
      idx++;
    }
    return list;
  }, [contractStartDate, contractEndDate, rentType]);

  // Resolve to the values the parent will persist.
  const resolution: BackdatedResolution | null = useMemo(() => {
    if (!startDate || !choice) return null;

    const currentCycle = (() => {
      const c = getCycleByStartMonth(today.getFullYear(), today.getMonth() + 1, anchorDay);
      if (today < c.start) {
        const prevM = today.getMonth();
        const py = today.getFullYear() + (prevM - 1 < 0 ? -1 : 0);
        const pm = (prevM - 1 + 12) % 12;
        return getCycleByStartMonth(py, pm + 1, anchorDay);
      }
      return c;
    })();

    if (choice === "all_paid") {
      const paidUpTo = isoOf(addDays(currentCycle.start, -1));
      return { kind: "all_paid", paidUpTo, openingBalance: 0, openingBalanceDate: null };
    }
    if (choice === "some_unpaid") {
      if (firstUnpaidIndex == null) return null;
      const p = periods.find((x) => x.index === firstUnpaidIndex);
      if (!p) return null;
      const paidUpTo = isoOf(addDays(p.start, -1));
      return {
        kind: "some_unpaid",
        paidUpTo,
        arrearsStartDate: p.startIso,
        firstUnpaidIndex: p.index,
        openingBalance: 0,
        openingBalanceDate: null,
      };
    }
    if (choice === "manual") {
      const amt = Number(manualAmount);
      if (!Number.isFinite(amt) || amt < 0 || manualAmount === "") return null;
      const paidUpTo = isoOf(addDays(currentCycle.start, -1));
      return {
        kind: "manual",
        openingBalance: amt,
        openingBalanceDate: currentCycle.startIso,
        paidUpTo,
      };
    }
    return null;
  }, [choice, firstUnpaidIndex, manualAmount, contractStartDate, anchorDay, periods]);

  useEffect(() => {
    onResolved(resolution);
  }, [resolution, onResolved]);

  // Live preview.
  const preview = useMemo(() => {
    if (!startDate || !resolution) return null;
    const virtual: UnitForBalance = {
      id: "_preview",
      rent_amount: rentAmount,
      rent_type: rentType,
      rent_timing: rentTiming,
      due_day: anchorDay,
      contract_start_date: contractStartDate,
      paid_up_to: resolution.paidUpTo,
      opening_balance: resolution.openingBalance,
      opening_balance_date: resolution.openingBalanceDate,
    };
    const lng: "ar" | "en" = ar ? "ar" : "en";
    const arrears = getUnitArrears(virtual, [], new Date(), lng);
    const next = getNextDueInfo(virtual, [], lng);

    // Paid periods label + months count (option 2 only).
    let paidPeriodsLabel: string | null = null;
    let arrearsMonths = 0;
    let arrearsStartLabel: string | null = null;
    if (resolution.kind === "some_unpaid") {
      const tapped = periods.find((p) => p.index === resolution.firstUnpaidIndex);
      if (tapped) {
        arrearsStartLabel = fmtDMY(tapped.start);
        const paid = periods.filter((p) => p.index < tapped.index);
        if (paid.length > 0) {
          const range =
            paid.length === 1
              ? ar ? `الشهر 1` : `Month 1`
              : ar
                ? `الأشهر 1–${paid.length}`
                : `Months 1–${paid.length}`;
          paidPeriodsLabel = `${range} · ${fmtPeriod(paid[0].start, paid[paid.length - 1].end)}`;
        }
        arrearsMonths = periodsElapsed(tapped.start, new Date(), rentType) +
          ((rentTiming || "advance") === "arrears" ? 0 : 1);
      }
    } else if (resolution.kind === "manual") {
      const d = parseLocalDate(resolution.openingBalanceDate);
      if (d) arrearsStartLabel = fmtDMY(d);
    }

    const arrearsAmount = Number(arrears.totalShortfall || 0).toFixed(3);
    const arrearsIsZero = (arrears.totalShortfall || 0) < 0.005;
    const arrearsSuffix =
      resolution.kind === "some_unpaid" && arrearsMonths > 0
        ? ar ? ` (${arrearsMonths} ${arrearsMonths === 1 ? "شهر" : "أشهر"})` : ` (${arrearsMonths} ${arrearsMonths === 1 ? "month" : "months"})`
        : "";

    return {
      paidPeriodsLabel,
      arrearsStartLabel,
      arrearsAmount,
      arrearsIsZero,
      arrearsSuffix,
      nextDue: next?.receiptLabel || "—",
    };
  }, [resolution, rentAmount, rentType, rentTiming, anchorDay, contractStartDate, lang, periods]);

  const startLabel = startDate ? fmtDMY(startDate) : "—";

  return (
    <div
      className="relative overflow-hidden rounded-3xl p-5 my-1 shadow-xl"
      style={{
        background: "linear-gradient(145deg, #1a1f2b 0%, #0e1118 100%)",
        border: "1px solid rgba(201, 164, 76, 0.35)",
      }}
      dir={ar ? "rtl" : "ltr"}
    >
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: "linear-gradient(90deg, transparent, #c9a44c, transparent)" }}
      />

      <div className="flex items-start gap-3 mb-4">
        <div
          className="shrink-0 h-9 w-9 rounded-full flex items-center justify-center"
          style={{ background: "rgba(201, 164, 76, 0.15)", border: "1px solid rgba(201, 164, 76, 0.4)" }}
        >
          <AlertTriangle className="h-4 w-4" style={{ color: "#c9a44c" }} />
        </div>
        <div className="flex-1">
          <h3 className="text-[15px] font-bold leading-tight" style={{ color: "#c9a44c" }}>
            {ar ? "عقد بتاريخ سابق" : "Backdated contract"}
          </h3>
          <p className="text-[12px] mt-1 leading-relaxed" style={{ color: "#b8bcc8" }}>
            {ar
              ? `بدأ هذا العقد في ${startLabel}، قبل أن تبدأ باستخدام التطبيق. أخبرنا عن الأشهر السابقة لتجنّب حساب متأخرات خاطئة.`
              : `This contract started ${startLabel}, before you began using the app. Tell us about the previous months to avoid wrong arrears.`}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <OptionRow
          selected={choice === "all_paid"}
          onClick={() => setChoice("all_paid")}
          label={ar ? "كل الأشهر السابقة مدفوعة" : "All previous months were paid"}
        />

        <OptionRow
          selected={choice === "some_unpaid"}
          onClick={() => setChoice("some_unpaid")}
          label={ar ? "بعض الأشهر غير مدفوعة" : "Some months are unpaid"}
        />
        {choice === "some_unpaid" && (
          <div className="ms-9 mt-2">
            <label className="text-[11px] font-semibold block mb-2" style={{ color: "#b8bcc8" }}>
              {ar ? "اضغط على أول شهر غير مدفوع" : "Tap the first unpaid month"}
            </label>
            <div
              className="max-h-72 overflow-y-auto rounded-2xl p-1.5 space-y-1.5"
              style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(201, 164, 76, 0.15)" }}
            >
              {periods.length === 0 && (
                <p className="text-[12px] text-center py-3" style={{ color: "#8a8f9c" }}>
                  {ar ? "لا توجد فترات سابقة" : "No prior periods"}
                </p>
              )}
              {periods.map((p) => {
                const tapped = firstUnpaidIndex;
                const status: "paid" | "first" | "future" | "neutral" =
                  tapped == null ? "neutral" : p.index < tapped ? "paid" : p.index === tapped ? "first" : "future";
                return (
                  <PeriodRow
                    key={p.index}
                    index={p.index}
                    label={fmtPeriod(p.start, p.end)}
                    status={status}
                    ar={ar}
                    onClick={() => setFirstUnpaidIndex(p.index)}
                  />
                );
              })}
            </div>
          </div>
        )}

        <OptionRow
          selected={choice === "manual"}
          onClick={() => setChoice("manual")}
          label={ar ? "إدخال رصيد سابق يدوياً" : "Enter prior balance manually"}
        />
        {choice === "manual" && (
          <div className="ms-9 mt-1.5">
            <label className="text-[11px] font-semibold block mb-1.5" style={{ color: "#b8bcc8" }}>
              {ar ? "المبلغ السابق (ر.ع)" : "Prior amount (OMR)"}
            </label>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.001"
              value={manualAmount}
              onChange={(e) => setManualAmount(e.target.value)}
              placeholder="0.000"
              className="h-10 rounded-xl border-0 text-[13px]"
              style={{ background: "rgba(255,255,255,0.06)", color: "#e8eaed", border: "1px solid rgba(201, 164, 76, 0.25)" }}
            />
          </div>
        )}
      </div>

      {preview && (
        <div
          className="mt-4 rounded-2xl p-3.5 space-y-2"
          style={{ background: "rgba(201, 164, 76, 0.06)", border: "1px solid rgba(201, 164, 76, 0.25)" }}
        >
          <p
            className="text-[10.5px] font-bold tracking-wider uppercase mb-1"
            style={{ color: "#c9a44c", letterSpacing: "0.08em" }}
          >
            {ar ? "معاينة مباشرة" : "Live preview"}
          </p>
          {preview.paidPeriodsLabel && (
            <PreviewRow
              label={ar ? "الفترات المدفوعة" : "Paid periods"}
              value={<span style={{ color: "#7ed9a8" }} className="font-semibold">{preview.paidPeriodsLabel}</span>}
            />
          )}
          {preview.arrearsStartLabel && (
            <PreviewRow
              label={ar ? "بداية المتأخرات" : "Arrears start"}
              value={preview.arrearsStartLabel}
            />
          )}
          <PreviewRow
            label={ar ? "المتأخرات الآن" : "Arrears right now"}
            value={
              <span
                className="inline-flex items-center gap-1 font-bold"
                style={{ color: preview.arrearsIsZero ? "#c9a44c" : "#e0a85d" }}
              >
                {preview.arrearsIsZero && <Check className="h-3.5 w-3.5" />}
                {preview.arrearsAmount} {ar ? "ر.ع" : "OMR"}{preview.arrearsSuffix}
              </span>
            }
          />
          <PreviewRow label={ar ? "المستحق الجاري" : "Current month due"} value={preview.nextDue} />
        </div>
      )}

      {(!choice || (choice === "some_unpaid" && firstUnpaidIndex == null)) && (
        <p className="mt-3 text-[11px] text-center font-semibold" style={{ color: "#e0a85d" }}>
          {!choice
            ? ar ? "⚠ اختر أحد الخيارات أعلاه قبل الحفظ" : "⚠ Pick one of the options above before saving"
            : ar ? "⚠ اضغط على أول شهر غير مدفوع" : "⚠ Tap the first unpaid month"}
        </p>
      )}
    </div>
  );
}

function OptionRow({ selected, onClick, label }: { selected: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-2xl px-3.5 py-3 text-start transition-all"
      style={{
        background: selected ? "rgba(201, 164, 76, 0.12)" : "rgba(255, 255, 255, 0.03)",
        border: `1px solid ${selected ? "#c9a44c" : "rgba(255, 255, 255, 0.08)"}`,
      }}
    >
      <span
        className="shrink-0 h-5 w-5 rounded-full flex items-center justify-center"
        style={{
          border: `2px solid ${selected ? "#c9a44c" : "rgba(255, 255, 255, 0.3)"}`,
          background: selected ? "#c9a44c" : "transparent",
        }}
      >
        {selected && <span className="h-2 w-2 rounded-full" style={{ background: "#0e1118" }} />}
      </span>
      <span className="text-[13px] font-semibold flex-1" style={{ color: selected ? "#e8eaed" : "#b8bcc8" }}>
        {label}
      </span>
    </button>
  );
}

function PeriodRow({
  index,
  label,
  status,
  ar,
  onClick,
}: {
  index: number;
  label: string;
  status: "paid" | "first" | "future" | "neutral";
  ar: boolean;
  onClick: () => void;
}) {
  const styles = {
    paid:    { bg: "rgba(126, 217, 168, 0.10)", border: "rgba(126, 217, 168, 0.35)", pillBg: "rgba(126, 217, 168, 0.18)", pillColor: "#7ed9a8", pillText: ar ? "مدفوع" : "Paid" },
    first:   { bg: "rgba(201, 164, 76, 0.18)",  border: "#c9a44c",                    pillBg: "#c9a44c",                   pillColor: "#0e1118", pillText: ar ? "أول غير مدفوع" : "First unpaid" },
    future:  { bg: "rgba(224, 154, 154, 0.08)", border: "rgba(224, 154, 154, 0.30)", pillBg: "rgba(224, 154, 154, 0.18)", pillColor: "#e09a9a", pillText: ar ? "سيُحتسب" : "Will be counted" },
    neutral: { bg: "rgba(255,255,255,0.03)",    border: "rgba(255,255,255,0.08)",    pillBg: "rgba(255,255,255,0.06)",    pillColor: "#8a8f9c", pillText: "—" },
  }[status];

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-all"
      style={{ background: styles.bg, border: `1px solid ${styles.border}` }}
    >
      <span
        className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold"
        style={{
          background: status === "first" ? "#c9a44c" : "rgba(201, 164, 76, 0.15)",
          color: status === "first" ? "#0e1118" : "#c9a44c",
          border: status === "first" ? "none" : "1px solid rgba(201, 164, 76, 0.4)",
        }}
      >
        {index}
      </span>
      <span className="text-[12.5px] font-semibold flex-1" style={{ color: "#e8eaed" }}>
        {label}
      </span>
      <span
        className="shrink-0 text-[10.5px] font-bold px-2 py-1 rounded-md"
        style={{ background: styles.pillBg, color: styles.pillColor }}
      >
        {styles.pillText}
      </span>
    </button>
  );
}

function PreviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[12px]">
      <span style={{ color: "#8a8f9c" }}>{label}</span>
      <span style={{ color: "#e8eaed" }} className="font-semibold text-end">{value}</span>
    </div>
  );
}
