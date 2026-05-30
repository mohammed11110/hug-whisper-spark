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
  /** Lease-level override: last date already paid before this lease started.
   *  Arrears accrue strictly AFTER this date — anything before is ignored. */
  paid_up_to?: string | null;
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
  /** Lease (tenancy) this payment belongs to. Source of truth for isolating
   *  a new tenant's balance from a previous tenant's payments on the same unit. */
  tenancy_id?: string | null;
}

/** Opening-kind payments are NOT real receipts — they represent prior
 *  arrears converted from the old `units.opening_balance` column. */
export const isOpeningPayment = (p: PaymentForBalance): boolean =>
  (p.kind || "rent") === "opening";

/** Rent payments are real receipts the tenant actually paid. */
export const isRentPayment = (p: PaymentForBalance): boolean =>
  (p.kind || "rent") === "rent";

/** Manual balance adjustments (waiver/discount when positive, extra charge when negative). */
export const isAdjustmentPayment = (p: PaymentForBalance): boolean =>
  (p.kind || "rent") === "adjustment";


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

/** Anchor date for due-day calculations. The lease's `paid_up_to` always
 *  wins when set (arrears start the day after). Otherwise prefers
 *  `opening_balance_date` (= last settlement), then `contract_start_date`. */
export function getAnchorDate(unit: { contract_start_date?: string | null; opening_balance_date?: string | null; paid_up_to?: string | null }): Date | null {
  // paid_up_to: arrears start the next day. We move the anchor forward by 1 day
  // so cycles align to "first day after the last paid period".
  if (unit.paid_up_to) {
    const p = new Date(unit.paid_up_to);
    if (!Number.isNaN(p.getTime())) {
      p.setDate(p.getDate() + 1);
      return p;
    }
  }
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
  activeTenancyId?: string | null,
): UnitArrears {
  const anchor = getAnchorDate(unit);

  // === Current-tenancy isolation ===
  // PRIMARY filter: strict equality on tenancy_id when known.
  //   - If activeTenancyId is provided, only payments with that exact
  //     tenancy_id (or NULL tenancy_id that passes the date cutoff) are
  //     counted. Payments tied to a previous tenancy are excluded.
  // FALLBACK filter (for payments with NULL tenancy_id — legacy rows
  // pre-backfill): the earliest of (opening_balance_date, contract_start_date)
  // on the CURRENT unit. EndTenancyDialog clears these fields and
  // NewTenancyDialog re-sets them.
  const cutoffIso =
    [unit.paid_up_to, unit.opening_balance_date, unit.contract_start_date]
      .filter((v): v is string => Boolean(v))
      .sort()
      .pop() || null; // largest (most recent) wins — paid_up_to dominates when set
  const inCurrentTenancy = (p: PaymentForBalance): boolean => {
    if (p.unit_id !== unit.id) return true;
    if (activeTenancyId && p.tenancy_id) {
      return p.tenancy_id === activeTenancyId;
    }
    if (!cutoffIso) return true;
    const ref = p.period_start || p.payment_date || null;
    return !ref || ref >= cutoffIso;
  };
  payments = payments.filter(inCurrentTenancy);


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
      (p) => p.unit_id === unit.id && !p.deleted_at && isRentPayment(p) && isPostAnchorPayment(p, anchorIso),
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

// =====================================================================
// Six-state running-balance view — single source of truth for UI badges.
// Computes everything live:
//   totalDue  = cycles_due * rent + Σ opening payments
//   totalPaid = Σ rent payments (kind='rent', !deleted_at)
//   balance   = totalDue − totalPaid
// Status is derived; nothing is stored. After every payment mutation,
// callers should invalidate their local payments cache and re-render —
// see `src/lib/paymentsBus.ts`.
// =====================================================================

export type RentStatus =
  | "paid"      // balance <= 0 and at least one payment exists
  | "credit"    // balance < 0 (tenant paid in advance)
  | "upcoming"  // balance > 0 but today < nextDueDate
  | "due"       // today === nextDueDate
  | "grace"     // nextDueDate < today <= nextDueDate + grace_days
  | "overdue"   // past grace, balance > 0
  | "critical"; // balance >= 2 * rent

export interface UnitBalance {
  totalDue: number;
  totalPaid: number;
  /** Positive = tenant owes; negative = credit (paid in advance). */
  balance: number;
  /** balance when > 0, else 0. */
  arrears: number;
  /** |balance| when < 0, else 0. */
  credit: number;
  status: RentStatus;
  /** Days since the oldest unpaid due_date (0 when not overdue). */
  daysLate: number;
  nextDueDate: Date | null;
  nextDueAmount: number;
  /** Whether at least one rent payment has been recorded. */
  hasPayments: boolean;
  /** Number of full rent-months currently outstanding (ceil(balance / rent)). */
  monthsLate: number;
  /** Most recent due-date that has already passed (latest accrued cycle). */
  upToMonth: Date | null;
  /** Oldest due-date still unpaid based on `monthsLate`. */
  fromMonth: Date | null;
}

export interface UnitForCalc extends UnitForBalance {
  /** Optional grace period (days) after due_day before status becomes 'overdue'. */
  grace_days?: number | null;
}

const dayOfMonth = (d: Date) => d.getDate();

/** Find the next due_date relative to `today` for a monthly contract. */
function nextDueDateFor(unit: UnitForCalc, today: Date): Date | null {
  const anchor = unit.contract_start_date || unit.opening_balance_date || null;
  if (!anchor) return null;
  const dueDay = Math.min(28, Math.max(1, Math.floor(Number(unit.due_day) || dayOfMonth(new Date(anchor)) || 1)));
  // Start at this month's due_day and walk forward until >= today.
  const candidate = new Date(today.getFullYear(), today.getMonth(), dueDay);
  if (candidate < today) candidate.setMonth(candidate.getMonth() + 1);
  return candidate;
}

/** Days since the oldest unpaid due_date (0 when none). */
function computeDaysLate(unit: UnitForCalc, balance: number, today: Date): number {
  if (balance <= 0.009) return 0;
  const rent = num(unit.rent_amount);
  if (rent <= 0) return 0;
  const anchor = unit.contract_start_date || unit.opening_balance_date || null;
  if (!anchor) return 0;
  const start = new Date(anchor);
  const dueDay = Math.min(28, Math.max(1, Math.floor(Number(unit.due_day) || start.getDate() || 1)));
  // Walk through every due_date from contract start until today, find oldest
  // whose cumulative due exceeds the balance (= the period that's unpaid).
  const cursor = new Date(start.getFullYear(), start.getMonth(), dueDay);
  if (cursor < start) cursor.setMonth(cursor.getMonth() + 1);
  // unpaidCycles = how many cycles' worth of rent the tenant currently owes.
  const unpaidCycles = Math.max(1, Math.ceil(balance / rent));
  // The oldest unpaid due_date is the (Nth-from-latest) due_date that's <= today.
  const dues: Date[] = [];
  while (cursor <= today) {
    dues.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  if (dues.length === 0) return 0;
  const oldestUnpaid = dues[Math.max(0, dues.length - unpaidCycles)];
  const diff = Math.floor((today.getTime() - oldestUnpaid.getTime()) / 86400000);
  return Math.max(0, diff);
}

/**
 * Compute the running-balance view for a unit. The single source of truth
 * for arrears, status, credit and next-due across the entire app.
 */
export function calculateUnitBalance(
  unit: UnitForCalc,
  payments: PaymentForBalance[] = [],
  today: Date = new Date(),
): UnitBalance {
  const rent = num(unit.rent_amount);
  const grace = Math.max(0, Math.min(30, Math.floor(Number(unit.grace_days) || 0)));

  // ----- totalDue: cycles_due × rent + opening rows + legacy opening_balance
  const dueCycles = cyclesDue(unit, today);
  const legacyOpening = Math.max(0, num(unit.opening_balance));
  const openingPays = payments.filter(
    (p) => p.unit_id === unit.id && !p.deleted_at && isOpeningPayment(p),
  );
  const openingDue = legacyOpening > 0
    ? legacyOpening
    : openingPays.reduce((s, p) => s + num(p.amount), 0);
  const totalDue = dueCycles * rent + openingDue;

  // ----- totalPaid: kind='rent' receipts + kind='adjustment' (signed: positive = waiver/discount, negative = extra charge)
  const rentPays = payments.filter(
    (p) => p.unit_id === unit.id && !p.deleted_at && isRentPayment(p),
  );
  const adjustments = payments.filter(
    (p) => p.unit_id === unit.id && !p.deleted_at && isAdjustmentPayment(p),
  );
  const totalPaid =
    rentPays.reduce((s, p) => s + num(p.amount), 0) +
    adjustments.reduce((s, p) => s + num(p.amount), 0);


  const balance = totalDue - totalPaid;
  const arrears = balance > 0.009 ? balance : 0;
  const credit = balance < -0.009 ? Math.abs(balance) : 0;
  const hasPayments = rentPays.length > 0;

  const nextDueDate = nextDueDateFor(unit, today);
  const nextDueAmount = rent;

  // ----- Derive status
  let status: RentStatus;
  if (balance < -0.009) {
    status = "credit";
  } else if (balance <= 0.009) {
    status = "paid";
  } else if (rent > 0 && balance >= 2 * rent) {
    status = "critical";
  } else if (nextDueDate) {
    const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const dueMs = new Date(nextDueDate.getFullYear(), nextDueDate.getMonth(), nextDueDate.getDate()).getTime();
    const graceCutoffMs = dueMs + grace * 86400000;
    if (todayMs < dueMs) {
      // We owe money but the next due date hasn't arrived → there's an older
      // unpaid cycle. Treat as overdue (or critical handled above).
      status = arrears > 0 ? "overdue" : "upcoming";
    } else if (todayMs === dueMs) {
      status = "due";
    } else if (todayMs <= graceCutoffMs) {
      status = "grace";
    } else {
      status = "overdue";
    }
  } else {
    status = arrears > 0 ? "overdue" : "paid";
  }

  const daysLate = computeDaysLate(unit, balance, today);

  // ----- monthsLate / fromMonth / upToMonth — month-range view of the arrears.
  // monthsLate = number of full rent-cycles the tenant still owes (ceil).
  // upToMonth  = latest due-date that has already passed (most recent accrued).
  // fromMonth  = oldest unpaid due-date based on monthsLate.
  let monthsLate = 0;
  let upToMonth: Date | null = null;
  let fromMonth: Date | null = null;
  if (arrears > 0 && rent > 0 && (unit.rent_type || "monthly") === "monthly") {
    monthsLate = Math.ceil(arrears / rent);
    const anchor = getAnchorDate(unit);
    if (anchor) {
      const anchorDay = getAnchorDay(unit);
      const elapsed = periodsElapsed(anchor, today, "monthly");
      const timing = (unit.rent_timing || "advance") === "arrears" ? "arrears" : "advance";
      const latestIdx = Math.max(0, timing === "arrears" ? elapsed - 1 : elapsed);
      const monthIdxUp = anchor.getMonth() + latestIdx;
      const upCycle = getCycleByStartMonth(
        anchor.getFullYear() + Math.floor(monthIdxUp / 12),
        ((monthIdxUp % 12) + 12) % 12 + 1,
        anchorDay,
      );
      upToMonth = timing === "arrears" ? upCycle.end : upCycle.start;
      const fromIdx = Math.max(0, latestIdx - (monthsLate - 1));
      const monthIdxFrom = anchor.getMonth() + fromIdx;
      const fromCycle = getCycleByStartMonth(
        anchor.getFullYear() + Math.floor(monthIdxFrom / 12),
        ((monthIdxFrom % 12) + 12) % 12 + 1,
        anchorDay,
      );
      fromMonth = timing === "arrears" ? fromCycle.end : fromCycle.start;
    }
  }

  return {
    totalDue,
    totalPaid,
    balance,
    arrears,
    credit,
    status,
    daysLate,
    nextDueDate,
    nextDueAmount,
    hasPayments,
    monthsLate,
    upToMonth,
    fromMonth,
  };
}


// =====================================================================
// Derived arrears spec (per product brief):
//   balance = totalDue - totalPaid
//   totalDue = N(due-day occurrences from contract_start..today) * rent
//   totalPaid = sum of payment amounts (kind != 'opening', not deleted)
//   status: balance<=0 → 'paid' | balance>=2*rent → 'critical' | else 'overdue'
//
// Pure function — UI must call this on render, never trust persisted status.
// =====================================================================

export interface DerivedBalance {
  balance: number;
  arrears: number;
  credit: number;
  totalDue: number;
  totalPaid: number;
  status: "paid" | "overdue" | "critical";
}

export function calculateBalance(
  unit: {
    id: string;
    rent_amount: number | string;
    due_day?: number | null;
    contract_start_date?: string | null;
  },
  payments: PaymentForBalance[],
  today: Date = new Date(),
): DerivedBalance {
  const rent = num(unit.rent_amount);
  const startStr = unit.contract_start_date;
  let n = 0;
  if (startStr) {
    const start = new Date(startStr);
    if (!Number.isNaN(start.getTime()) && today >= start) {
      const dueDay = Math.min(31, Math.max(1, Number(unit.due_day) || start.getDate()));
      // First due date >= contract_start, anchored on dueDay (clamped to month-end).
      const clampedDay = (year: number, monthIdx: number) => {
        const lastDay = new Date(year, monthIdx + 1, 0).getDate();
        return Math.min(dueDay, lastDay);
      };
      let y = start.getFullYear();
      let m = start.getMonth();
      let cur = new Date(y, m, clampedDay(y, m));
      if (cur < start) {
        m += 1;
        if (m > 11) { m = 0; y += 1; }
        cur = new Date(y, m, clampedDay(y, m));
      }
      while (cur <= today) {
        n += 1;
        m += 1;
        if (m > 11) { m = 0; y += 1; }
        cur = new Date(y, m, clampedDay(y, m));
      }
    }
  }
  const totalDue = n * rent;
  const totalPaid = payments
    .filter((p) => p.unit_id === unit.id && !p.deleted_at && (p.kind || "rent") !== "opening")
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const balance = totalDue - totalPaid;
  const status: DerivedBalance["status"] =
    balance <= 0 ? "paid" : balance >= rent * 2 && rent > 0 ? "critical" : "overdue";
  return {
    balance,
    arrears: balance > 0 ? balance : 0,
    credit: balance < 0 ? Math.abs(balance) : 0,
    totalDue,
    totalPaid,
    status,
  };
}
