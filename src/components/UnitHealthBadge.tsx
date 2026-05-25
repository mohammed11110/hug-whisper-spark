import { useMemo } from "react";
import { getUnitArrears, type UnitForBalance, type PaymentForBalance } from "@/lib/balance";
import { useI18n } from "@/lib/i18n";

interface Props {
  unit: UnitForBalance;
  payments: PaymentForBalance[];
  className?: string;
}

/**
 * مؤشّر صحة الحساب — قراءة فورية لحالة الوحدة المالية:
 *   ممتاز   → لا متأخرات + يوجد سداد سابق
 *   جيد     → لا متأخرات (مستأجر جديد، لم يحن الاستحقاق)
 *   متأخر   → دورة واحدة أو دورتان غير مكتملتين
 *   حرج    → 3 دورات فأكثر غير مكتملة
 *
 * مصدر الحقيقة: getUnitArrears (نفس منطق الباقي).
 */
export function UnitHealthBadge({ unit, payments, className }: Props) {
  const { lang } = useI18n();
  const ar = lang === "ar";

  const level = useMemo(() => {
    const a = getUnitArrears(unit, payments, new Date(), lang as "ar" | "en");
    const overdueCycles = a.cycles.filter((c) => c.status !== "paid").length;
    const hasOpening = (a.openingBalance || 0) > 0.009;
    const totalOverdue = overdueCycles + (hasOpening ? 1 : 0);
    const hasPayments = (payments || []).length > 0;

    if (a.totalShortfall < 0.01) {
      return hasPayments
        ? { key: "excellent", label: ar ? "ممتاز" : "Excellent", icon: "◆", style: "bg-sage-100 text-sage-700 border-sage-300" }
        : { key: "good", label: ar ? "جديد" : "New", icon: "○", style: "bg-slate-100 text-slate-700 border-slate-300" };
    }
    if (totalOverdue >= 3) {
      return { key: "critical", label: ar ? "حرج" : "Critical", icon: "▲", style: "bg-burgundy/15 text-burgundy border-burgundy/40" };
    }
    return { key: "late", label: ar ? "متأخر" : "Late", icon: "●", style: "bg-terracotta/15 text-terracotta border-terracotta/40" };
  }, [unit, payments, ar, lang]);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${level.style} ${className || ""}`.trim()}
      title={ar ? "مؤشّر صحة الحساب" : "Account health"}
    >
      <span aria-hidden className="text-[8px] leading-none">{level.icon}</span>
      <span>{ar ? "الصحة: " : "Health: "}{level.label}</span>
    </span>
  );
}
