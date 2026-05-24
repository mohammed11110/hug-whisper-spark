import { useMemo } from "react";
import { getUnitArrears, type UnitForBalance, type PaymentForBalance } from "@/lib/balance";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";

interface Props {
  unit: UnitForBalance;
  payments: PaymentForBalance[];
  className?: string;
  /** When true, renders a slightly larger block-style badge for detail pages. */
  block?: boolean;
}

/**
 * شارة موجزة بجانب اسم المستأجر تُظهر أقدم شهر فيه نقص + المبلغ.
 * تعرض الفرق فقط (الإيجار − المدفوع لتلك الدورة)، فإن تعدّدت الدورات
 * يُضاف +N. صامتة إذا لا متبقٍّ.
 */
export function ArrearsBadge({ unit, payments, className, block }: Props) {
  const { lang } = useI18n();
  const { format } = useCurrency();

  const arrears = useMemo(
    () => getUnitArrears(unit, payments, new Date(), lang as "ar" | "en"),
    [unit, payments, lang],
  );

  if (!arrears.oldestUnpaid || arrears.unpaidCount <= 0) return null;

  const extra = arrears.unpaidCount - 1;
  const label = arrears.oldestUnpaid.label;
  const amount = format(arrears.totalShortfall);
  const prefix = lang === "ar" ? "متأخر" : "Overdue";
  const plus = extra > 0 ? ` +${extra}` : "";

  const text = `${prefix}: ${label}${plus} − ${amount}`;
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
