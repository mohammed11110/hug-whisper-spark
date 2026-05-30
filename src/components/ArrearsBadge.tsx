import { useMemo } from "react";
import { getUnitArrears, calculateUnitBalance, type UnitForBalance, type PaymentForBalance, type ArrearsCycle } from "@/lib/balance";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";


interface Props {
  unit: UnitForBalance;
  payments: PaymentForBalance[];
  className?: string;
  /** When true, renders a slightly larger block-style badge for detail pages. */
  block?: boolean;
}

const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const MONTHS_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const isPrior = (c: ArrearsCycle, lang: "ar" | "en") =>
  c.label === (lang === "ar" ? "متأخرات سابقة" : "Prior arrears");

/** Short month label: "مايو" / "May" (year added separately). */
const monthOnly = (d: Date, lang: "ar" | "en") =>
  (lang === "ar" ? MONTHS_AR : MONTHS_EN)[d.getMonth()];

const monthYear = (d: Date, lang: "ar" | "en") =>
  `${monthOnly(d, lang)} ${d.getFullYear()}`;

/**
 * شارة موجزة بجانب اسم المستأجر تُظهر نطاق الأشهر المتأخرة:
 * - دورة واحدة كاملة: «متأخر: مايو 2026 − 250»
 * - دورة واحدة جزئية: «متأخر: مايو 2026 (جزئي) − 30»
 * - عدة دورات: «متأخر: مارس → مايو 2026 − 530»
 * - الأقدم جزئية: «متأخر: مارس (جزئي) → مايو 2026 − 530»
 * - متأخرات سابقة فقط: «متأخر: سابقة − 405»
 * - سابقة + شهور: «متأخر: سابقة → مايو 2026 − 655»
 * صامتة إذا لا متبقٍّ.
 */
export function ArrearsBadge({ unit, payments, className, block }: Props) {
  const { lang } = useI18n();
  const { format } = useCurrency();
  const L = lang as "ar" | "en";

  const arrears = useMemo(
    () => getUnitArrears(unit, payments, new Date(), L),
    [unit, payments, L],
  );

  const text = useMemo(() => {
    const unpaid = arrears.cycles.filter((c) => c.shortfall > 0.009);
    if (unpaid.length === 0) return null;

    const oldest = unpaid[0];
    const latest = unpaid[unpaid.length - 1];
    const prefix = L === "ar" ? "متأخر" : "Overdue";
    const partial = L === "ar" ? "جزئي" : "partial";
    const priorWord = L === "ar" ? "سابقة" : "Prior";
    const arrow = " → ";
    const amount = format(arrears.totalShortfall);

    const oldestIsPrior = isPrior(oldest, L);
    const latestIsPrior = isPrior(latest, L);

    // Helper: render a single (non-prior) cycle label
    const renderCycle = (c: ArrearsCycle, withYear: boolean) => {
      const base = withYear ? monthYear(c.periodStart, L) : monthOnly(c.periodStart, L);
      return c.status === "partial" ? `${base} (${partial})` : base;
    };

    // Case 1: only one unpaid entry
    if (unpaid.length === 1) {
      const label = oldestIsPrior
        ? (oldest.status === "partial" ? `${priorWord} (${partial})` : priorWord)
        : renderCycle(oldest, true);
      return `${prefix}: ${label} − ${amount}`;
    }

    // Case 2: multiple — render oldest → latest
    const sameYear =
      !oldestIsPrior && !latestIsPrior &&
      oldest.periodStart.getFullYear() === latest.periodStart.getFullYear();

    const oldestLabel = oldestIsPrior
      ? priorWord
      : renderCycle(oldest, !sameYear); // omit year when same-year (will appear once on latest)

    const latestLabel = latestIsPrior
      ? priorWord
      : renderCycle(latest, true);

    return `${prefix}: ${oldestLabel}${arrow}${latestLabel} − ${amount}`;
  }, [arrears, L, format]);

  // Show a credit chip when the tenant has paid in advance (negative balance).
  const credit = useMemo(() => {
    const b = calculateUnitBalance(unit as any, payments, new Date());
    return b.credit > 0.009 ? b.credit : 0;
  }, [unit, payments]);

  if (!text && credit > 0) {
    const lbl = L === "ar" ? `رصيد دائن: ${format(credit)}` : `Credit: ${format(credit)}`;
    const size = block ? "text-[11px] px-2.5 py-1 mt-1" : "text-[10px] px-2 py-0.5 mt-1";
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full font-bold text-sage-700 bg-sage-100 border border-sage-300 ${size} ${className || ""}`.trim()}
        title={lbl}
      >
        <span aria-hidden className="text-[9px] leading-none">✦</span>
        <span className="truncate">{lbl}</span>
      </span>
    );
  }

  if (!text) return null;

  const base =
    "inline-flex items-center gap-1 rounded-full font-bold text-burgundy bg-burgundy/10 border border-burgundy/25";
  const size = block
    ? "text-[11px] px-2.5 py-1 mt-1"
    : "text-[10px] px-2 py-0.5 mt-1";

  return (
    <span className={`${base} ${size} ${className || ""}`.trim()} title={text}>
      <span aria-hidden className="text-[9px] leading-none">⚠</span>
      <span className="truncate">{text}</span>
    </span>
  );
}

