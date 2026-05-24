import { describe, it, expect } from "vitest";
import { getUnitArrears, distributePayment } from "@/lib/balance";

// سيناريو ياسر: opening_balance = 405، دفع 40 → المتبقي يجب أن يكون 365.
// قبل الإصلاح كانت دفعة «متأخرات سابقة» (period_start == period_end == anchor)
// تُحتسب مرة في opening_balance ومرة في أول دورة شهرية → 325 بدلًا من 365.
describe("getUnitArrears — prior arrears double-counting guard", () => {
  const baseUnit = {
    id: "u1",
    rent_amount: 250,
    rent_type: "monthly",
    rent_timing: "advance",
    contract_start_date: "2026-05-10",
    opening_balance: 405,
    opening_balance_date: "2026-05-10",
  } as const;

  it("لا تخصم دفعة المتأخرات السابقة من أول دورة إيجار", () => {
    // دفعة 40 سُجِّلت كسداد جزئي لـ«متأخرات سابقة» بنطاق يوم واحد
    const payments = [
      {
        unit_id: "u1",
        amount: 40,
        deleted_at: null,
        payment_date: "2026-05-10",
        period_start: "2026-05-10",
        period_end: "2026-05-10",
      },
    ];
    // نُحاكي تخفيض opening_balance بمقدار 40 (يحدث في AddPaymentDialog بعد الحفظ)
    const unit = { ...baseUnit, opening_balance: 365 };
    const arr = getUnitArrears(unit as any, payments as any, new Date("2026-05-15"));
    const prior = arr.cycles.find((c) => c.label.includes("سابقة") || c.label.toLowerCase().includes("prior"));
    expect(prior?.shortfall).toBe(365);
    // أول دورة شهرية يجب ألا تتأثر بدفعة المتأخرات السابقة
    const monthly = arr.cycles.filter((c) => c !== prior);
    monthly.forEach((c) => expect(c.paid).toBe(0));
  });

  it("distributePayment لمبلغ 40 على متأخرات 405 يخصم 40 فقط", () => {
    const arr = getUnitArrears(baseUnit as any, [], new Date("2026-05-15"));
    expect(arr.totalShortfall).toBeGreaterThanOrEqual(405);
    const dist = distributePayment(baseUnit as any, arr, 40);
    const collected = dist.allocations
      .filter((a) => !a.isAdvance)
      .reduce((s, a) => s + a.amount, 0);
    expect(collected).toBe(40);
  });

  // عند حذف الإيصال (deleted_at != null) يجب أن تعود المتأخرات لما كانت عليه
  // بشرط ألا نلمس opening_balance عند الحفظ (السلوك الجذري الجديد).
  it("حذف إيصال المتأخرات يعيد القيمة كاملة 405", () => {
    const payments = [
      {
        unit_id: "u1",
        amount: 40,
        deleted_at: "2026-05-12T00:00:00Z",
        payment_date: "2026-05-10",
        period_start: "2026-05-10",
        period_end: "2026-05-10",
      },
    ];
    const arr = getUnitArrears(baseUnit as any, payments as any, new Date("2026-05-15"));
    const prior = arr.cycles.find((c) => c.label.includes("سابقة") || c.label.toLowerCase().includes("prior"));
    expect(prior?.shortfall).toBe(405);
  });
});
