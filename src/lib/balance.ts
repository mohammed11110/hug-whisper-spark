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
  /** Day-of-month (1..28) at which monthly rent becomes due. */
  due_day?: number | null;
}


export interface PaymentForBalance {
  unit_id: string;
  amount: number | string;
  deleted_at?: string | null;
  payment_date?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  /** 'rent' (default, reduces balance) | 'opening' (adds to balance — legacy
   *  prior arrears) | 'adjustment'. Opening rows are excluded from "paid"
   *  sums and instead treated as additional due. */
  kind?: string | null;
}

/** Opening-kind payments are NOT real receipts — they represent prior
 *  arrears converted from the old `units.opening_balance` column. */
export const isOpeningPayment = (p: PaymentForBalance): boolean =>
  (p.kind || "rent") === "opening";

/** Rent payments are real receipts the tenant actually paid. */
export const isRentPayment = (p: PaymentForBalance): boolean =>
  (p.kind || "rent") === "rent";

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

/** Day-of-month used as the anchor for monthly cycles (1..28).
 *  Prefers `unit.due_day` when set, otherwise falls back to the day-of-month
 *  of `opening_balance_date` / `contract_start_date`. */
export function getAnchorDay(unit: { contract_start_date?: string | null; opening_balance_date?: string | null; due_day?: number | null }): number {
  const dd = Number((unit as any).due_day);
  if (Number.isFinite(dd) && dd >= 1) return Math.min(28, Math.max(1, Math.floor(dd)));
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
    .filter((p) => p.unit_id === unit.id && !p.deleted_at && isRentPayment(p) && isPostAnchorPayment(p, anchorIso))
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
    .filter((p) => p.unit_id === unit.id && !p.deleted_at && isRentPayment(p) && isPostAnchorPayment(p, anchorIso))
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
  //    نخصم منها الدفعات «المُوجَّهة للمتأخرات السابقة» وهي الدفعات ذات
  //    نطاق يوم واحد (period_start == period_end) على تاريخ المرسى.
  // 1) Prior arrears — either from legacy `unit.opening_balance` (for units
  //    created before the migration) OR from migrated payments rows with
  //    kind='opening'. Both paths sum into `opening`.
  const legacyOpening = Math.max(0, num(unit.opening_balance));
  const openingPays = payments.filter(
    (p) => p.unit_id === unit.id && !p.deleted_at && isOpeningPayment(p),
  );
  const openingFromRows = openingPays.reduce((s, p) => s + num(p.amount), 0);
  const opening = legacyOpening > 0 ? legacyOpening : openingFromRows;

  const cycles: ArrearsCycle[] = [];
  let totalShortfall = 0;
  let unpaidCount = 0;
  let oldestUnpaid: ArrearsCycle | null = null;

  if (opening > 0) {
    const anchorIsoForOpening =
      unit.opening_balance_date ||
      openingPays[0]?.period_start ||
      unit.contract_start_date ||
      null;
    const obDate = anchorIsoForOpening ? new Date(anchorIsoForOpening) : (anchor || asOf);
    const obIso = anchorIsoForOpening || ISO(obDate);

    // Prior-arrears installments are recorded as single-day RENT payments
    // anchored on the prior-arrears date. Opening rows themselves are
    // excluded so we don't double-count.
    const priorPaid = payments
      .filter(
        (p) =>
          p.unit_id === unit.id &&
          !p.deleted_at &&
          isRentPayment(p) &&
          p.period_start && p.period_end &&
          p.period_start === p.period_end &&
          (!anchorIsoForOpening || p.period_start === anchorIsoForOpening),
      )
      .reduce((s, p) => s + num(p.amount), 0);

    const openingRemaining = Math.max(0, opening - priorPaid);

    if (openingRemaining > 0.009) {
      const priorCycle: ArrearsCycle = {
        periodStart: obDate,
        periodEnd: obDate,
        periodStartIso: obIso,
        periodEndIso: obIso,
        label: lang === "ar" ? "متأخرات سابقة" : "Prior arrears",
        rent: opening,
        paid: priorPaid,
        shortfall: openingRemaining,
        status: priorPaid > 0.009 ? "partial" : "unpaid",
      };
      cycles.push(priorCycle);
      totalShortfall += openingRemaining;
      unpaidCount += 1;
      oldestUnpaid = priorCycle;
    }
  }

  // 2) دورات إيجار شهرية منذ المرسى.
  const rent = num(unit.rent_amount);
  if (anchor && rent > 0 && (unit.rent_type || "monthly") === "monthly") {
    const anchorDay = getAnchorDay(unit);
    const timing = (unit.rent_timing || "advance") === "arrears" ? "arrears" : "advance";
    const anchorIso = unit.opening_balance_date || unit.contract_start_date || null;
    const elapsed = periodsElapsed(anchor, asOf, "monthly");
    const baseCycles = timing === "advance" ? elapsed + 1 : elapsed;

    const unitPays = payments.filter(
      (p) => p.unit_id === unit.id && !p.deleted_at && isPostAnchorPayment(p, anchorIso),
    );

    // CRITICAL: استبعد دفعات «متأخرات سابقة» من تجميع دفعات الدورات الشهرية.
    // هذه الدفعات تُسجَّل بنطاق يوم واحد (period_start == period_end == anchor)
    // وقد تتطابق صدفةً مع بداية أوّل دورة شهرية، فتُخصم مرّتين (مرة من
    // opening_balance ومرة كدفعة دورة). المنع هنا هو الحل الجذري.
    const cyclePays = unitPays.filter(
      (p) => !(p.period_start && p.period_end && p.period_start === p.period_end),
    );

    const buildCycle = (i: number): ArrearsCycle => {
      const cycleMonthIdx = anchor.getMonth() + i;
      const cycleYear = anchor.getFullYear() + Math.floor(cycleMonthIdx / 12);
      const cycleMonth1to12 = ((cycleMonthIdx % 12) + 12) % 12 + 1;
      const c = getCycleByStartMonth(cycleYear, cycleMonth1to12, anchorDay);

      // Match by OVERLAP rather than start-within-cycle, so a payment whose
      // recorded period uses a different day-of-month (e.g. 1→30) still
      // counts toward a cycle anchored on a custom due_day (e.g. 23→22).
      const paid = cyclePays
        .filter((p) => {
          if (!p.period_start) return false;
          const ps = p.period_start;
          const pe = p.period_end || p.period_start;
          return ps <= c.endIso && pe >= c.startIso;
        })
        .reduce((s, p) => s + num(p.amount), 0);


      const shortfall = Math.max(0, rent - paid);
      const status: ArrearsCycle["status"] =
        shortfall <= 0.009 ? "paid" : paid > 0.009 ? "partial" : "unpaid";
      return {
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
    };

    for (let i = 0; i < baseCycles; i++) {
      const cycle = buildCycle(i);
      cycles.push(cycle);
      if (cycle.shortfall > 0.009) {
        totalShortfall += cycle.shortfall;
        unpaidCount += 1;
        if (!oldestUnpaid) oldestUnpaid = cycle;
      }
    }

    // 2.b) في وضع «مؤخّر»: أدرج الدورة الجارية إن وُجدت عليها دفعة جزئية
    //      (paid > 0 و paid < rent) — حتى يظهر النقص فوراً للمستخدم
    //      دون أن نزعجه بدورات مستقبلية فارغة.
    if (timing === "arrears") {
      const currentIdx = elapsed; // الدورة الجارية (لم تنتهِ بعد)
      const cycle = buildCycle(currentIdx);
      if (cycle.paid > 0.009 && cycle.shortfall > 0.009) {
        cycles.push(cycle);
        totalShortfall += cycle.shortfall;
        unpaidCount += 1;
        if (!oldestUnpaid) oldestUnpaid = cycle;
      }
    }
  }

  return { cycles, oldestUnpaid, totalShortfall, unpaidCount, openingBalance: opening };
}

// =====================================================================
// Distribute a single payment amount across arrears cycles + optional
// future cycles (treated as advance payments). Oldest → newest.
// =====================================================================
export interface PaymentAllocation {
  periodStartIso: string;
  periodEndIso: string;
  label: string;
  expected: number;
  amount: number;
  isAdvance: boolean;
  isPrior: boolean;
}

export interface PaymentDistribution {
  allocations: PaymentAllocation[];
  remainder: number;
  totalAllocated: number;
}

const EPS = 0.009;

export function distributePayment(
  unit: UnitForBalance,
  arrears: UnitArrears,
  totalAmount: number,
  lang: "ar" | "en" = "ar",
  maxAdvanceCycles: number = 24,
): PaymentDistribution {
  const priorLabel = lang === "ar" ? "متأخرات سابقة" : "Prior arrears";
  const allocations: PaymentAllocation[] = [];
  let remaining = Math.max(0, num(totalAmount));
  const rent = num(unit.rent_amount);

  // 1) Pay outstanding cycles oldest → newest.
  const unpaid = arrears.cycles.filter((c) => c.shortfall > EPS);
  for (const c of unpaid) {
    if (remaining <= EPS) break;
    const apply = Math.min(remaining, c.shortfall);
    allocations.push({
      periodStartIso: c.periodStartIso,
      periodEndIso: c.periodEndIso,
      label: c.label,
      expected: c.label === priorLabel ? c.shortfall : rent,
      amount: apply,
      isAdvance: false,
      isPrior: c.label === priorLabel,
    });
    remaining -= apply;
  }

  // 2) Spill leftover into future cycles (advance).
  if (remaining > EPS && rent > 0 && (unit.rent_type || "monthly") === "monthly") {
    const anchor = getAnchorDate(unit);
    if (anchor) {
      const anchorDay = getAnchorDay(unit);
      const monthlyCycles = arrears.cycles.filter((c) => c.label !== priorLabel);
      const startIdx = monthlyCycles.length;
      for (let i = 0; i < maxAdvanceCycles; i++) {
        if (remaining <= EPS) break;
        const cycleMonthIdx = anchor.getMonth() + startIdx + i;
        const cy = anchor.getFullYear() + Math.floor(cycleMonthIdx / 12);
        const cm = ((cycleMonthIdx % 12) + 12) % 12 + 1;
        const c = getCycleByStartMonth(cy, cm, anchorDay);
        const apply = Math.min(remaining, rent);
        const label = buildReceiptPeriodLabel(c.start, c.end, anchorDay, lang)
          .replace(/^إيجار شهر\s+/, "")
          .replace(/^إيجار الفترة\s+/, "")
          .replace(/^Rent for\s+/, "")
          .replace(/^Rent\s+/, "");
        allocations.push({
          periodStartIso: c.startIso,
          periodEndIso: c.endIso,
          label,
          expected: rent,
          amount: apply,
          isAdvance: true,
          isPrior: false,
        });
        remaining -= apply;
      }
    }
  }

  const totalAllocated = allocations.reduce((s, a) => s + a.amount, 0);
  return { allocations, remainder: Math.max(0, remaining), totalAllocated };
}


