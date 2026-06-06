import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import {
  parseLocalDate,
  getCycleByStartMonth,
  getUnitArrears,
  getNextDueInfo,
  type UnitForBalance,
} from "@/lib/balance";

export type BackdatedResolution =
  | { kind: "all_paid"; paidUpTo: string; openingBalance: 0; openingBalanceDate: null }
  | { kind: "some_unpaid"; paidUpTo: string; firstUnpaidMonth: string; openingBalance: 0; openingBalanceDate: null }
  | { kind: "manual"; openingBalance: number; openingBalanceDate: string; paidUpTo: string };

interface Props {
  contractStartDate: string; // ISO YYYY-MM-DD
  rentAmount: number;
  rentType: string;
  rentTiming: "advance" | "arrears";
  dueDay: number;
  onResolved: (r: BackdatedResolution | null) => void;
}

const AR_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const EN_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/**
 * MANDATORY backdated-contract handler. Shown only when contract_start_date
 * is strictly before today. Forces the user to choose one of three options
 * so the running-balance engine doesn't fabricate arrears for the months
 * BEFORE the user started using the app.
 */
export function BackdatedContractCard({
  contractStartDate,
  rentAmount,
  rentType,
  rentTiming,
  dueDay,
  onResolved,
}: Props) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const M = ar ? AR_MONTHS : EN_MONTHS;

  const [choice, setChoice] = useState<"" | "all_paid" | "some_unpaid" | "manual">("");
  const [firstUnpaid, setFirstUnpaid] = useState<string>(""); // "YYYY-MM"
  const [manualAmount, setManualAmount] = useState<string>("");

  const anchorDay = Math.min(28, Math.max(1, Math.floor(dueDay || 1)));
  const startDate = parseLocalDate(contractStartDate);
  const today = new Date();

  // Cycle list from the contract-start month → current month (inclusive).
  const cycleOptions = useMemo(() => {
    if (!startDate) return [] as { value: string; label: string; cycleStartIso: string }[];
    const list: { value: string; label: string; cycleStartIso: string }[] = [];
    let y = startDate.getFullYear();
    let m = startDate.getMonth();
    const endY = today.getFullYear();
    const endM = today.getMonth();
    for (let safety = 0; safety < 120; safety++) {
      const c = getCycleByStartMonth(y, m + 1, anchorDay);
      list.push({
        value: `${y}-${String(m + 1).padStart(2, "0")}`,
        label: `${M[m]} ${y}`,
        cycleStartIso: c.startIso,
      });
      if (y === endY && m === endM) break;
      m += 1;
      if (m > 11) { m = 0; y += 1; }
    }
    return list;
  }, [contractStartDate, anchorDay, lang]);

  // Default the first-unpaid picker to the contract-start month so the
  // dropdown is never empty when the user toggles option 2.
  useEffect(() => {
    if (cycleOptions.length && !firstUnpaid) {
      setFirstUnpaid(cycleOptions[0].value);
    }
  }, [cycleOptions, firstUnpaid]);

  // Reset when contract_start_date changes (e.g. user edits the date).
  useEffect(() => {
    setChoice("");
    setManualAmount("");
  }, [contractStartDate]);

  // Resolve to the values the parent will persist + push upward.
  const resolution: BackdatedResolution | null = useMemo(() => {
    if (!startDate || !choice) return null;

    // Current cycle = the cycle whose window contains today.
    const currentCycle = (() => {
      const c = getCycleByStartMonth(today.getFullYear(), today.getMonth() + 1, anchorDay);
      // If today is BEFORE this cycle's start (e.g. day=15 anchor, today=10),
      // the active cycle actually started last month.
      if (today < c.start) {
        const prevM = today.getMonth(); // already current; use previous month
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
      const opt = cycleOptions.find((o) => o.value === firstUnpaid);
      if (!opt) return null;
      const cs = parseLocalDate(opt.cycleStartIso);
      if (!cs) return null;
      const paidUpTo = isoOf(addDays(cs, -1));
      return { kind: "some_unpaid", paidUpTo, firstUnpaidMonth: firstUnpaid, openingBalance: 0, openingBalanceDate: null };
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
  }, [choice, firstUnpaid, manualAmount, contractStartDate, anchorDay, cycleOptions]);

  useEffect(() => {
    onResolved(resolution);
  }, [resolution, onResolved]);

  // Live preview — simulate a unit with the resolved fields.
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

    // Ignored period label.
    const firstCountedIso =
      resolution.kind === "manual"
        ? resolution.openingBalanceDate
        : resolution.kind === "some_unpaid"
          ? cycleOptions.find((o) => o.value === resolution.firstUnpaidMonth)?.cycleStartIso || null
          : (() => {
              const d = parseLocalDate(resolution.paidUpTo);
              if (!d) return null;
              return isoOf(addDays(d, 1));
            })();
    const firstCounted = firstCountedIso ? parseLocalDate(firstCountedIso) : null;

    const startLabel = `${M[startDate.getMonth()]} ${startDate.getFullYear()}`;
    const ignoredEnd = firstCounted ? new Date(firstCounted.getFullYear(), firstCounted.getMonth() - 1, 1) : null;
    const ignoredEndLabel = ignoredEnd ? `${M[ignoredEnd.getMonth()]} ${ignoredEnd.getFullYear()}` : null;
    const ignoredLabel =
      !firstCounted || (firstCounted.getFullYear() === startDate.getFullYear() && firstCounted.getMonth() === startDate.getMonth())
        ? ar ? "لا شيء" : "None"
        : ignoredEndLabel && ignoredEndLabel !== startLabel
          ? ar ? `${startLabel} — ${ignoredEndLabel}` : `${startLabel} – ${ignoredEndLabel}`
          : startLabel;

    const firstCountedLabel = firstCounted
      ? `${M[firstCounted.getMonth()]} ${firstCounted.getFullYear()}`
      : "—";

    return {
      ignoredLabel,
      firstCountedLabel,
      arrearsNow: Number(arrears.totalShortfall || 0).toFixed(3),
      arrearsIsZero: (arrears.totalShortfall || 0) < 0.005,
      nextDue: next?.receiptLabel || "—",
    };
  }, [resolution, rentAmount, rentType, rentTiming, anchorDay, contractStartDate, lang]);

  const startLabel = startDate ? `${M[startDate.getMonth()]} ${startDate.getDate()}, ${startDate.getFullYear()}` : "—";

  return (
    <div
      className="relative overflow-hidden rounded-3xl p-5 my-1 shadow-xl"
      style={{
        background: "linear-gradient(145deg, #1a1f2b 0%, #0e1118 100%)",
        border: "1px solid rgba(201, 164, 76, 0.35)",
      }}
      dir={ar ? "rtl" : "ltr"}
    >
      {/* gold accent strip */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: "linear-gradient(90deg, transparent, #c9a44c, transparent)" }}
      />

      <div className="flex items-start gap-3 mb-4">
        <div
          className="shrink-0 h-9 w-9 rounded-full flex items-center justify-center"
          style={{ background: "rgba(201, 164, 76, 0.15)", border: "1px solid rgba(201, 164, 76, 0.4)" }}
        >
          <AlertTriangle className="h-4.5 w-4.5" style={{ color: "#c9a44c" }} />
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

      {/* options */}
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
          <div className="ms-9 mt-1.5">
            <label className="text-[11px] font-semibold block mb-1.5" style={{ color: "#b8bcc8" }}>
              {ar ? "أوّل شهر غير مدفوع" : "First unpaid month"}
            </label>
            <Select value={firstUnpaid} onValueChange={setFirstUnpaid}>
              <SelectTrigger
                className="h-10 rounded-xl border-0 text-[13px]"
                style={{ background: "rgba(255,255,255,0.06)", color: "#e8eaed", border: "1px solid rgba(201, 164, 76, 0.25)" }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {cycleOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

      {/* live preview */}
      {preview && (
        <div
          className="mt-4 rounded-2xl p-3.5 space-y-2"
          style={{
            background: "rgba(201, 164, 76, 0.06)",
            border: "1px solid rgba(201, 164, 76, 0.25)",
          }}
        >
          <p className="text-[10.5px] font-bold tracking-wider uppercase mb-1" style={{ color: "#c9a44c", letterSpacing: "0.08em" }}>
            {ar ? "معاينة مباشرة" : "Live preview"}
          </p>
          <PreviewRow label={ar ? "الفترة المُتجاهَلة" : "Ignored period"} value={preview.ignoredLabel} />
          <PreviewRow label={ar ? "أوّل شهر محتسب" : "First month counted"} value={preview.firstCountedLabel} />
          <PreviewRow
            label={ar ? "المتأخرات الآن" : "Arrears right now"}
            value={
              <span className="inline-flex items-center gap-1 font-bold" style={{ color: preview.arrearsIsZero ? "#c9a44c" : "#e0a85d" }}>
                {preview.arrearsIsZero && <Check className="h-3.5 w-3.5" />}
                {preview.arrearsNow} {ar ? "ر.ع" : "OMR"}
              </span>
            }
          />
          <PreviewRow label={ar ? "المستحق الجاري" : "Current month due"} value={preview.nextDue} />
        </div>
      )}

      {!choice && (
        <p className="mt-3 text-[11px] text-center font-semibold" style={{ color: "#e0a85d" }}>
          {ar ? "⚠ اختر أحد الخيارات أعلاه قبل الحفظ" : "⚠ Pick one of the options above before saving"}
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

function PreviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[12px]">
      <span style={{ color: "#8a8f9c" }}>{label}</span>
      <span style={{ color: "#e8eaed" }} className="font-semibold text-end">{value}</span>
    </div>
  );
}
