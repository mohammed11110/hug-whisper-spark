// Unified financial balance helper for a unit.
// Balance = opening_balance + accrued rent since contract/opening start − payments received.

export interface UnitForBalance {
  id: string;
  rent_amount: number | string;
  rent_type: string; // monthly | daily | yearly
  rent_timing?: string | null; // 'advance' (default) | 'arrears'
  contract_start_date?: string | null;
  opening_balance?: number | string | null;
  opening_balance_date?: string | null;
}


export interface PaymentForBalance {
  unit_id: string;
  amount: number | string;
  deleted_at?: string | null;
  payment_date?: string | null;
  period_start?: string | null;
  period_end?: string | null;
}

/**
 * A payment belongs to the *current* settlement window (i.e. should offset
 * accrued rent from the anchor onward) only if the cycle it covers ends
 * at/after the anchor. Falls back to payment_date for legacy rows without
 * period_end.
 */
const isPostAnchorPayment = (p: PaymentForBalance, anchorIso: string | null): boolean => {
  if (!anchorIso) return true;
  if (p.period_end) return p.period_end >= anchorIso;
  if (p.period_start) return p.period_start >= anchorIso;
  if (p.payment_date) return p.payment_date >= anchorIso;
  return true;
};



const num = (v: any) => Number(v) || 0;

/** Number of full rent periods elapsed from a start date until "now". */
export function periodsElapsed(start: Date, now: Date, rentType: string): number {
  if (now <= start) return 0;
  if (rentType === "daily") {
    const ms = now.getTime() - start.getTime();
    return Math.max(0, Math.floor(ms / 86400000));
  }
  if (rentType === "yearly") {
    let y = now.getFullYear() - start.getFullYear();
    const before =
      now.getMonth() < start.getMonth() ||
      (now.getMonth() === start.getMonth() && now.getDate() < start.getDate());
    if (before) y -= 1;
    return Math.max(0, y);
  }
  // monthly (default) — anchored on the start date's day-of-month.
  // Example: start = 10/1/2026 → cycle 0 = 10/1→9/2, cycle 1 = 10/2→9/3, …
  let m = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) m -= 1;
  return Math.max(0, m);
}

/**
 * Number of rent cycles that are due-to-pay as of `asOf`.
 * - advance: cycle 1 starts AT the anchor, due immediately → elapsed + 1
 * - arrears: cycle 1 ends after one period, due at its end → elapsed
 */
export function cyclesDue(unit: UnitForBalance, asOf: Date = new Date()): number {
  const startStr = unit.opening_balance_date || unit.contract_start_date || null;
  if (!startStr) return 0;
  const start = new Date(startStr);
  if (Number.isNaN(start.getTime()) || asOf < start) return 0;
  const elapsed = periodsElapsed(start, asOf, unit.rent_type || "monthly");
  const timing = (unit.rent_timing || "advance") === "arrears" ? "arrears" : "advance";
  return timing === "advance" ? elapsed + 1 : elapsed;
}

export function computeBalance(unit: UnitForBalance, payments: PaymentForBalance[]) {
  const rent = num(unit.rent_amount);
  const opening = num(unit.opening_balance);
  const periods = cyclesDue(unit, new Date());
  const accrued = rent * periods;
  const totalDue = opening + accrued;

  // Only count payments that belong to the current settlement window
  // (i.e. on/after opening_balance_date). Payments older than the anchor
  // already settled past cycles and must not offset new accrued rent.
  const anchorIso = unit.opening_balance_date || unit.contract_start_date || null;
  const paid = payments
    .filter((p) => p.unit_id === unit.id && !p.deleted_at)
    .filter((p) => isPostAnchorPayment(p, anchorIso))

    .reduce((s, p) => s + num(p.amount), 0);

  const outstanding = Math.max(0, totalDue - paid);
  return { opening, accrued, totalDue, paid, outstanding };
}


// =====================================================================
// Cycle helpers — anchor-aware periods + smart receipt labels.
// A "cycle" is one full rent period anchored on the contract-start day-of-month.
// Example: contract starts 10/1/2026 → cycle whose month-index is January is
// the window 10/1/2026 → 9/2/2026. Day-1 contracts collapse to the calendar
// month (1/M → last/M).
// =====================================================================

const ISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Anchor date for due-day calculations. Prefers opening_balance_date (= last settlement). */
export function getAnchorDate(unit: { contract_start_date?: string | null; opening_balance_date?: string | null }): Date | null {
  const s = unit.opening_balance_date || unit.contract_start_date || null;
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Day-of-month used as the anchor for monthly cycles (1..28, capped). */
export function getAnchorDay(unit: { contract_start_date?: string | null; opening_balance_date?: string | null }): number {
  const a = getAnchorDate(unit);
  return a ? Math.min(28, Math.max(1, a.getDate())) : 1;
}

/**
 * The monthly cycle whose START falls in `year/month1to12`.
 * For anchor day D: cycle = D/M → (D-1)/(M+1).  For D=1 → 1/M → last day of M.
 */
export function getCycleByStartMonth(year: number, month1to12: number, anchorDay: number) {
  const d = Math.min(28, Math.max(1, anchorDay || 1));
  const start = new Date(year, month1to12 - 1, d);
  const end = d === 1
    ? new Date(year, month1to12, 0) // last day of same month
    : new Date(year, month1to12, d - 1); // day before anchor of next month
  return { start, end, startIso: ISO(start), endIso: ISO(end) };
}

/** Localized receipt label for a payment that covers a given cycle. */
export function buildReceiptPeriodLabel(
  cycleStart: Date,
  cycleEnd: Date,
  anchorDay: number,
  lang: "ar" | "en" = "ar",
): string {
  const monthsAr = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  const monthsEn = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const M = lang === "ar" ? monthsAr : monthsEn;
  if (anchorDay === 1) {
    const m = M[cycleStart.getMonth()];
    const y = cycleStart.getFullYear();
    return lang === "ar" ? `إيجار شهر ${m} ${y}` : `Rent for ${m} ${y}`;
  }
  const fmt = (d: Date) =>
    `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  return lang === "ar"
    ? `إيجار الفترة من ${fmt(cycleStart)} إلى ${fmt(cycleEnd)}`
    : `Rent for ${fmt(cycleStart)} – ${fmt(cycleEnd)}`;
}

/** Next due cycle for a unit, considering rent_timing. */
export function getNextDueInfo(
  unit: UnitForBalance,
  payments: PaymentForBalance[] = [],
  lang: "ar" | "en" = "ar",
) {
  const anchor = getAnchorDate(unit);
  if (!anchor) return null;
  const anchorDay = getAnchorDay(unit);
  const timing = (unit.rent_timing || "advance") === "arrears" ? "arrears" : "advance";

  const rent = num(unit.rent_amount);
  const anchorIso = unit.opening_balance_date || unit.contract_start_date || null;
  // Only count payments at/after the anchor — older payments are already
  // baked into opening_balance_date (= first unpaid cycle); counting them
  // again would double-advance the next-due cycle.
  const totalPaid = payments
    .filter((p) => p.unit_id === unit.id && !p.deleted_at && isPostAnchorPayment(p, anchorIso))
    .reduce((s, p) => s + num(p.amount), 0);

  const paidCycles = rent > 0 ? Math.floor(totalPaid / rent) : 0;
  const due = cyclesDue(unit, new Date());


  // Next billable cycle index (0-based from anchor): whichever is greater
  // between cycles already paid and cycles due.
  const dueIdx = Math.max(paidCycles, due);

  const cycleMonth = anchor.getMonth() + dueIdx;
  const cycle = getCycleByStartMonth(
    anchor.getFullYear() + Math.floor(cycleMonth / 12),
    (cycleMonth % 12 + 12) % 12 + 1,
    anchorDay,
  );

  const nextDueDate = timing === "advance" ? cycle.start : cycle.end;
  const receiptLabel = buildReceiptPeriodLabel(cycle.start, cycle.end, anchorDay, lang);
  return {
    nextDueDate,
    periodStart: cycle.start,
    periodEnd: cycle.end,
    periodStartIso: cycle.startIso,
    periodEndIso: cycle.endIso,
    receiptLabel,
    anchorDay,
    timing,
  };
}

/**
 * عدد الدورات المستحقة وغير المدفوعة حتى تاريخ معيّن (افتراضياً الآن).
 * يحترم نمط الدفع: في المؤخّر تُخصم الدورة الجارية، وفي المقدّم تُحتسب فور بدايتها.
 */
export function overdueCyclesCount(
  unit: UnitForBalance,
  payments: PaymentForBalance[] = [],
  asOf: Date = new Date(),
): number {
  const rent = num(unit.rent_amount);
  if (rent <= 0) return 0;
  const due = cyclesDue(unit, asOf);
  const anchorIso = unit.opening_balance_date || unit.contract_start_date || null;
  const paid = payments
    .filter((p) => p.unit_id === unit.id && !p.deleted_at && isPostAnchorPayment(p, anchorIso))
    .reduce((s, p) => s + num(p.amount), 0);

  const paidCycles = Math.floor(paid / rent);
  return Math.max(0, due - paidCycles);
}


/**
 * هل تاريخ الاستحقاق التالي لهذه الوحدة قد مضى (= فعلاً متأخّر الآن)؟
 */
export function isUnitOverdue(
  unit: UnitForBalance,
  payments: PaymentForBalance[] = [],
  asOf: Date = new Date(),
): boolean {
  return overdueCyclesCount(unit, payments, asOf) > 0;
}

/**
 * تفاصيل المتأخرات لكل دورة منذ المرسى. تجميع لكل دورة:
 * - rent: قيمة إيجار الدورة
 * - paid: مجموع المبالغ المدفوعة التي يقع period_start الخاص بها داخل نطاق الدورة
 * - shortfall: max(0, rent - paid)
 * - status: paid / partial / unpaid
 *
 * تُدرج فقط الدورات المستحقة (advance: بدأت ≤ اليوم؛ arrears: انتهت < اليوم).
 */
export interface ArrearsCycle {
  periodStart: Date;
  periodEnd: Date;
  periodStartIso: string;
  periodEndIso: string;
  label: string;
  rent: number;
  paid: number;
  shortfall: number;
  status: "paid" | "partial" | "unpaid";
}

export interface UnitArrears {
  cycles: ArrearsCycle[];
  oldestUnpaid: ArrearsCycle | null;
  totalShortfall: number;
  unpaidCount: number;
  /** opening_balance treated as prior arrears (≥ 0). Included in totalShortfall. */
  openingBalance: number;
}

/**
 * مصدر الحقيقة الوحيد للمتأخرات:
 *   متأخرات الوحدة = opening_balance (متأخرات سابقة)
 *                  + Σ (إيجار الدورة − المدفوع لها) لكل دورة مستحقة منذ المرسى
 *
 * advance: الدورة الجارية تُحتسب فور بدايتها.
 * arrears: لا تُدرج الدورة إلا بعد انتهائها.
 */
export function getUnitArrears(
  unit: UnitForBalance,
  payments: PaymentForBalance[] = [],
  asOf: Date = new Date(),
  lang: "ar" | "en" = "ar",
): UnitArrears {
  const opening = Math.max(0, num(unit.opening_balance));
  const anchor = getAnchorDate(unit);

  const cycles: ArrearsCycle[] = [];
  let totalShortfall = 0;
  let unpaidCount = 0;
  let oldestUnpaid: ArrearsCycle | null = null;

  // 1) متأخرات سابقة (opening_balance) — دورة افتراضية في رأس القائمة.
  if (opening > 0) {
    const anchorIsoForOpening = unit.opening_balance_date || unit.contract_start_date || null;
    const obDate = anchorIsoForOpening ? new Date(anchorIsoForOpening) : (anchor || asOf);
    const obIso = anchorIsoForOpening || ISO(obDate);
    const priorCycle: ArrearsCycle = {
      periodStart: obDate,
      periodEnd: obDate,
      periodStartIso: obIso,
      periodEndIso: obIso,
      label: lang === "ar" ? "متأخرات سابقة" : "Prior arrears",
      rent: opening,
      paid: 0,
      shortfall: opening,
      status: "unpaid",
    };
    cycles.push(priorCycle);
    totalShortfall += opening;
    unpaidCount += 1;
    oldestUnpaid = priorCycle;
  }

  // 2) دورات إيجار شهرية منذ المرسى.
  const rent = num(unit.rent_amount);
  if (anchor && rent > 0 && (unit.rent_type || "monthly") === "monthly") {
    const anchorDay = getAnchorDay(unit);
    const timing = (unit.rent_timing || "advance") === "arrears" ? "arrears" : "advance";
    const anchorIso = unit.opening_balance_date || unit.contract_start_date || null;
    const elapsed = periodsElapsed(anchor, asOf, "monthly");
    const cyclesToInspect = timing === "advance" ? elapsed + 1 : elapsed;

    if (cyclesToInspect > 0) {
      const unitPays = payments.filter(
        (p) => p.unit_id === unit.id && !p.deleted_at && isPostAnchorPayment(p, anchorIso),
      );

      for (let i = 0; i < cyclesToInspect; i++) {
        const cycleMonthIdx = anchor.getMonth() + i;
        const cycleYear = anchor.getFullYear() + Math.floor(cycleMonthIdx / 12);
        const cycleMonth1to12 = ((cycleMonthIdx % 12) + 12) % 12 + 1;
        const c = getCycleByStartMonth(cycleYear, cycleMonth1to12, anchorDay);

        const paid = unitPays
          .filter((p) => p.period_start && p.period_start >= c.startIso && p.period_start <= c.endIso)
          .reduce((s, p) => s + num(p.amount), 0);

        const shortfall = Math.max(0, rent - paid);
        const status: ArrearsCycle["status"] =
          shortfall <= 0.009 ? "paid" : paid > 0.009 ? "partial" : "unpaid";
        const cycle: ArrearsCycle = {
          periodStart: c.start,
          periodEnd: c.end,
          periodStartIso: c.startIso,
          periodEndIso: c.endIso,
          label: buildReceiptPeriodLabel(c.start, c.end, anchorDay, lang)
            .replace(/^إيجار شهر\s+/, "")
            .replace(/^إيجار الفترة\s+/, "")
            .replace(/^Rent for\s+/, "")
            .replace(/^Rent\s+/, ""),
          rent,
          paid,
          shortfall,
          status,
        };
        cycles.push(cycle);
        if (shortfall > 0.009) {
          totalShortfall += shortfall;
          unpaidCount += 1;
          if (!oldestUnpaid) oldestUnpaid = cycle;
        }
      }
    }
  }

  return { cycles, oldestUnpaid, totalShortfall, unpaidCount, openingBalance: opening };
}

