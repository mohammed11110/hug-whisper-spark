import { useMemo } from "react";
import {
  calculateUnitBalance,
  type UnitForCalc,
  type PaymentForBalance,
  type RentStatus,
} from "@/lib/balance";
import { useI18n } from "@/lib/i18n";

interface Props {
  unit: UnitForCalc;
  payments: PaymentForBalance[];
  className?: string;
  /** Active lease id — used to exclude any payment that belongs to an
   *  ended lease so a new tenant never inherits an old tenant's balance. */
  activeTenancyId?: string | null;
}

/**
 * Live financial status badge — single source of truth = calculateUnitBalance.
 * Six states mapped to brand-token colors. Never reads stored `units.status`.
 */
export function UnitHealthBadge({ unit, payments, className, activeTenancyId }: Props) {
  const { lang } = useI18n();
  const ar = lang === "ar";

  const view = useMemo(() => {
    // CRITICAL: when an active lease is known, drop every payment that has
    // a different tenancy_id. Payments with NULL tenancy_id fall through
    // and are filtered later by the date-cutoff inside calculateUnitBalance.
    const scoped = activeTenancyId
      ? payments.filter((p) => !p.tenancy_id || p.tenancy_id === activeTenancyId)
      : payments;
    const b = calculateUnitBalance(unit, scoped, new Date());
    const labelMap: Record<RentStatus, { ar: string; en: string }> = {
      paid:     { ar: "مسدّد",   en: "Paid" },
      credit:   { ar: "رصيد دائن", en: "Credit" },
      upcoming: { ar: "قادم",    en: "Upcoming" },
      due:      { ar: "مستحق اليوم", en: "Due today" },
      grace:    { ar: "فترة سماح", en: "Grace" },
      overdue:  { ar: "متأخّر",  en: "Overdue" },
      critical: { ar: "حرج",    en: "Critical" },
    };
    const styleMap: Record<RentStatus, string> = {
      paid:     "bg-sage-100 text-sage-700 border-sage-300",
      credit:   "bg-gold/15 text-[hsl(var(--gold,40_45%_45%))] border-gold/40",
      upcoming: "bg-slate-100 text-slate-700 border-slate-300",
      due:      "bg-gold/15 text-gold border-gold/40",
      grace:    "bg-terracotta/10 text-terracotta border-terracotta/30",
      overdue:  "bg-terracotta/15 text-terracotta border-terracotta/40",
      critical: "bg-burgundy/15 text-burgundy border-burgundy/40",
    };
    const iconMap: Record<RentStatus, string> = {
      paid: "◆", credit: "✦", upcoming: "○", due: "●",
      grace: "◐", overdue: "●", critical: "▲",
    };
    return {
      status: b.status,
      label: labelMap[b.status][ar ? "ar" : "en"],
      style: styleMap[b.status],
      icon: iconMap[b.status],
    };
  }, [unit, payments, ar]);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${view.style} ${className || ""}`.trim()}
      title={ar ? "حالة الحساب" : "Account status"}
    >
      <span aria-hidden className="text-[8px] leading-none">{view.icon}</span>
      <span>{view.label}</span>
    </span>
  );
}
