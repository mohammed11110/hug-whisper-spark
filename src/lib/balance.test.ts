import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  periodsElapsed,
  cyclesDue,
  computeBalance,
  overdueCyclesCount,
  isUnitOverdue,
  getNextDueInfo,
  getUnitArrears,
  type UnitForBalance,
  type PaymentForBalance,
} from "./balance";

// Helper to build a unit
const mkUnit = (overrides: Partial<UnitForBalance> = {}): UnitForBalance => ({
  id: "u1",
  rent_amount: 80,
  rent_type: "monthly",
  rent_timing: "advance",
  contract_start_date: "2026-01-01",
  opening_balance: 0,
  opening_balance_date: null,
  ...overrides,
});

const mkPayment = (amount: number, opts: Partial<PaymentForBalance> = {}): PaymentForBalance => ({
  unit_id: "u1",
  amount,
  deleted_at: null,
  ...opts,
});

// Fix "now" deterministically for tests that depend on Date.
const setNow = (iso: string) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
};

afterEach(() => {
  vi.useRealTimers();
});

describe("periodsElapsed", () => {
  it("returns 0 when now ≤ start", () => {
    expect(periodsElapsed(new Date("2026-04-01"), new Date("2026-04-01"), "monthly")).toBe(0);
    expect(periodsElapsed(new Date("2026-04-01"), new Date("2026-03-15"), "monthly")).toBe(0);
  });

  it("counts full monthly cycles anchored on day-of-month", () => {
    const start = new Date("2026-01-10");
    expect(periodsElapsed(start, new Date("2026-01-15"), "monthly")).toBe(0);
    expect(periodsElapsed(start, new Date("2026-02-09"), "monthly")).toBe(0);
    expect(periodsElapsed(start, new Date("2026-02-10"), "monthly")).toBe(1);
    expect(periodsElapsed(start, new Date("2026-05-09"), "monthly")).toBe(3);
    expect(periodsElapsed(start, new Date("2026-05-10"), "monthly")).toBe(4);
  });

  it("counts daily cycles", () => {
    expect(periodsElapsed(new Date("2026-04-01"), new Date("2026-04-05"), "daily")).toBe(4);
  });

  it("counts yearly cycles", () => {
    expect(periodsElapsed(new Date("2024-06-15"), new Date("2026-06-14"), "yearly")).toBe(1);
    expect(periodsElapsed(new Date("2024-06-15"), new Date("2026-06-15"), "yearly")).toBe(2);
  });
});

describe("cyclesDue — advance vs arrears difference per month", () => {
  // Scenario: contract starts 1/4/2026, rent 80/month.
  const advanceUnit = mkUnit({ rent_timing: "advance", contract_start_date: "2026-04-01" });
  const arrearsUnit = mkUnit({ rent_timing: "arrears", contract_start_date: "2026-04-01" });

  const cases: Array<{ at: string; advance: number; arrears: number; label: string }> = [
    { at: "2026-04-01", advance: 1, arrears: 0, label: "بداية أبريل (يوم العقد)" },
    { at: "2026-04-15", advance: 1, arrears: 0, label: "منتصف أبريل" },
    { at: "2026-04-30", advance: 1, arrears: 0, label: "آخر أبريل (قبل انتهاء الدورة)" },
    { at: "2026-05-01", advance: 2, arrears: 1, label: "بداية مايو (دورة أبريل اكتملت)" },
    { at: "2026-05-24", advance: 2, arrears: 1, label: "منتصف مايو" },
    { at: "2026-06-01", advance: 3, arrears: 2, label: "بداية يونيو" },
    { at: "2026-07-15", advance: 4, arrears: 3, label: "منتصف يوليو" },
  ];

  for (const c of cases) {
    it(`${c.label} @ ${c.at} → advance=${c.advance}, arrears=${c.arrears}`, () => {
      const asOf = new Date(c.at);
      expect(cyclesDue(advanceUnit, asOf)).toBe(c.advance);
      expect(cyclesDue(arrearsUnit, asOf)).toBe(c.arrears);
      // Advance must always lead arrears by exactly one cycle after the anchor.
      expect(cyclesDue(advanceUnit, asOf) - cyclesDue(arrearsUnit, asOf)).toBe(1);
    });
  }

  it("returns 0 before the anchor date in both modes", () => {
    const at = new Date("2026-03-31");
    expect(cyclesDue(advanceUnit, at)).toBe(0);
    expect(cyclesDue(arrearsUnit, at)).toBe(0);
  });

  it("prefers opening_balance_date over contract_start_date as anchor", () => {
    const u = mkUnit({
      rent_timing: "arrears",
      contract_start_date: "2026-01-01",
      opening_balance_date: "2026-04-01",
    });
    expect(cyclesDue(u, new Date("2026-05-15"))).toBe(1);
  });

  it("treats missing rent_timing as advance (default)", () => {
    const u = mkUnit({ rent_timing: null, contract_start_date: "2026-04-01" });
    expect(cyclesDue(u, new Date("2026-04-15"))).toBe(1);
  });

  it("returns 0 when no anchor date is set", () => {
    const u = mkUnit({ contract_start_date: null, opening_balance_date: null });
    expect(cyclesDue(u, new Date("2026-12-01"))).toBe(0);
  });
});

describe("computeBalance — accrued amount differs by payment timing", () => {
  it("advance: charges current cycle immediately (80 ر.ع at anchor)", () => {
    setNow("2026-04-01T12:00:00");
    const u = mkUnit({ rent_timing: "advance", contract_start_date: "2026-04-01" });
    const bal = computeBalance(u, []);
    expect(bal.accrued).toBe(80);
    expect(bal.outstanding).toBe(80);
  });

  it("arrears: no charge yet at anchor", () => {
    setNow("2026-04-01T12:00:00");
    const u = mkUnit({ rent_timing: "arrears", contract_start_date: "2026-04-01" });
    const bal = computeBalance(u, []);
    expect(bal.accrued).toBe(0);
    expect(bal.outstanding).toBe(0);
  });

  it("arrears: April cycle becomes due on 1/5", () => {
    setNow("2026-05-01T12:00:00");
    const u = mkUnit({ rent_timing: "arrears", contract_start_date: "2026-04-01" });
    expect(computeBalance(u, []).outstanding).toBe(80);
  });

  it("payments reduce outstanding and never go below zero", () => {
    setNow("2026-05-24T12:00:00");
    const u = mkUnit({ rent_timing: "advance", contract_start_date: "2026-04-01" });
    // advance @ 24/5 → 2 cycles due = 160
    expect(computeBalance(u, [mkPayment(80)]).outstanding).toBe(80);
    expect(computeBalance(u, [mkPayment(200)]).outstanding).toBe(0);
  });

  it("opening_balance is added on top of accrued rent", () => {
    setNow("2026-05-01T12:00:00");
    const u = mkUnit({
      rent_timing: "arrears",
      contract_start_date: "2026-04-01",
      opening_balance: 50,
      opening_balance_date: "2026-04-01",
    });
    const bal = computeBalance(u, []);
    expect(bal.opening).toBe(50);
    expect(bal.accrued).toBe(80);
    expect(bal.totalDue).toBe(130);
  });

  it("regression: arrears anchored at last-paid month → April overdue on 24/5", () => {
    // Tenant pays on 5/4/2026; in arrears that payment covers MARCH.
    // After fix, opening_balance_date is set to 2026-04-01 (not 2026-05-01),
    // so April's cycle (ends 30/4) is overdue on 24/5.
    const u = mkUnit({
      rent_timing: "arrears",
      contract_start_date: "2025-03-01",
      opening_balance_date: "2026-04-01",
    });
    setNow("2026-05-24T12:00:00");
    expect(cyclesDue(u, new Date("2026-05-24"))).toBe(1);
    expect(computeBalance(u, []).outstanding).toBe(80);
    expect(isUnitOverdue(u, [], new Date("2026-05-24"))).toBe(true);
  });

  it("3-field UI: arrears, periodTo=31/3 → anchor=1/4 → April overdue on 24/5", () => {
    // New semantic: opening_balance_date = day AFTER periodTo (= first day of
    // first unpaid cycle). For arrears w/ March covered, anchor=1/4.
    const u = mkUnit({
      rent_timing: "arrears",
      contract_start_date: "2025-03-01",
      opening_balance_date: "2026-04-01",
    });
    setNow("2026-05-24T12:00:00");
    expect(cyclesDue(u, new Date("2026-05-24"))).toBe(1);
    expect(computeBalance(u, []).outstanding).toBe(80);
  });

  it("3-field UI: advance, periodTo=30/4 → anchor=1/5 → May owed on 24/5", () => {
    const u = mkUnit({
      rent_timing: "advance",
      contract_start_date: "2025-04-01",
      opening_balance_date: "2026-05-01",
    });
    setNow("2026-05-24T12:00:00");
    // advance: cycle starting 1/5 is owed immediately → 1 cycle due.
    expect(cyclesDue(u, new Date("2026-05-24"))).toBe(1);
    expect(computeBalance(u, []).outstanding).toBe(80);
  });


  it("difference between advance and arrears equals one rent across many months", () => {
    const months = ["2026-04-01", "2026-05-01", "2026-06-15", "2026-08-01", "2026-12-01"];
    for (const at of months) {
      setNow(`${at}T12:00:00`);
      const adv = computeBalance(mkUnit({ rent_timing: "advance", contract_start_date: "2026-04-01" }), []);
      const arr = computeBalance(mkUnit({ rent_timing: "arrears", contract_start_date: "2026-04-01" }), []);
      expect(adv.outstanding - arr.outstanding).toBe(80);
    }
  });
});

describe("overdueCyclesCount & isUnitOverdue", () => {
  it("arrears: zero overdue when current cycle not yet ended", () => {
    const u = mkUnit({ rent_timing: "arrears", contract_start_date: "2026-04-01" });
    expect(overdueCyclesCount(u, [], new Date("2026-04-20"))).toBe(0);
    expect(isUnitOverdue(u, [], new Date("2026-04-20"))).toBe(false);
  });

  it("arrears: one overdue cycle after April ends if unpaid", () => {
    const u = mkUnit({ rent_timing: "arrears", contract_start_date: "2026-04-01" });
    expect(overdueCyclesCount(u, [], new Date("2026-05-15"))).toBe(1);
    expect(isUnitOverdue(u, [], new Date("2026-05-15"))).toBe(true);
  });

  it("advance: immediately overdue at anchor when unpaid", () => {
    const u = mkUnit({ rent_timing: "advance", contract_start_date: "2026-04-01" });
    expect(overdueCyclesCount(u, [], new Date("2026-04-01"))).toBe(1);
  });

  it("payments cancel overdue cycles one-for-one", () => {
    const u = mkUnit({ rent_timing: "advance", contract_start_date: "2026-04-01" });
    // @ 24/5: 2 cycles due → paying 80 leaves 1 overdue
    expect(overdueCyclesCount(u, [mkPayment(80)], new Date("2026-05-24"))).toBe(1);
    expect(overdueCyclesCount(u, [mkPayment(160)], new Date("2026-05-24"))).toBe(0);
  });

  it("soft-deleted payments are ignored", () => {
    const u = mkUnit({ rent_timing: "advance", contract_start_date: "2026-04-01" });
    const pays = [mkPayment(80, { deleted_at: "2026-04-10" })];
    expect(overdueCyclesCount(u, pays, new Date("2026-04-15"))).toBe(1);
  });

  it("payments before opening_balance_date are NOT counted (legacy March payment, anchor April 1)", () => {

    // Mirrors real bug: V2 unit V1 — arrears 200/mo, anchor 2026-04-01, only
    // payment is for March (period_end=2026-03-31, payment_date=2026-05-04, amount=200).
    // April rent is still unpaid; on 24/5 we must show 1 overdue cycle.
    const u = mkUnit({
      rent_amount: 200,
      rent_timing: "arrears",
      contract_start_date: "2026-01-01",
      opening_balance_date: "2026-04-01",
    });
    const marchPayment = mkPayment(200, { payment_date: "2026-05-04", period_start: "2026-03-01", period_end: "2026-03-31" } as any);
    expect(overdueCyclesCount(u, [marchPayment], new Date("2026-05-24"))).toBe(1);
    expect(isUnitOverdue(u, [marchPayment], new Date("2026-05-24"))).toBe(true);
    setNow("2026-05-24T12:00:00");
    expect(computeBalance(u, [marchPayment]).outstanding).toBe(200);
  });
});


describe("getNextDueInfo", () => {
  it("advance: with no payments, next billable jumps to the upcoming cycle", () => {
    const u = mkUnit({ rent_timing: "advance", contract_start_date: "2026-04-01" });
    setNow("2026-04-10T12:00:00");
    const info = getNextDueInfo(u, [])!;
    expect(info.timing).toBe("advance");
    // April already counts as due (cyclesDue=1), so the *next* billable cycle is May.
    expect(info.periodStartIso).toBe("2026-05-01");
    expect(info.nextDueDate.toISOString().slice(0, 10)).toBe("2026-05-01");
  });

  it("arrears: next due date is the END of the current cycle", () => {
    const u = mkUnit({ rent_timing: "arrears", contract_start_date: "2026-04-01" });
    setNow("2026-04-10T12:00:00");
    const info = getNextDueInfo(u, [])!;
    expect(info.timing).toBe("arrears");
    expect(info.periodStartIso).toBe("2026-04-01");
    expect(info.periodEndIso).toBe("2026-04-30");
    expect(info.nextDueDate.toISOString().slice(0, 10)).toBe("2026-04-30");
  });

  it("returns null when no anchor date exists", () => {
    const u = mkUnit({ contract_start_date: null, opening_balance_date: null });
    expect(getNextDueInfo(u, [])).toBeNull();
  });

  it("advances to the next cycle once it has been paid", () => {
    const u = mkUnit({ rent_timing: "advance", contract_start_date: "2026-04-01" });
    setNow("2026-04-10T12:00:00");
    const info = getNextDueInfo(u, [mkPayment(80)])!;
    // April paid → next billable is May
    expect(info.periodStartIso).toBe("2026-05-01");
  });

  it("regression B2#06: arrears with anchor already advanced past paid period", () => {
    // Payment 27/4 covered 1/4→30/4; anchor moved to 1/5. Today 24/5.
    // Next due must be May (not June) — the historical payment must not
    // double-advance the next-due cycle.
    const u = mkUnit({
      rent_timing: "arrears",
      contract_start_date: "2026-01-01",
      opening_balance_date: "2026-05-01",
    });
    setNow("2026-05-24T12:00:00");
    const info = getNextDueInfo(
      u,
      [mkPayment(80, { payment_date: "2026-04-27" })],
    )!;
    expect(info.periodStartIso).toBe("2026-05-01");
    expect(info.periodEndIso).toBe("2026-05-31");
  });
});

describe("getUnitArrears — partial-payment month tracking", () => {
  it("partial payment leaves shortfall labeled for that month", () => {
    const u = mkUnit({
      rent_amount: 200,
      rent_timing: "advance",
      contract_start_date: "2026-04-01",
      opening_balance_date: "2026-04-01",
    });
    // Partial 150 on April, nothing for May
    const pays: PaymentForBalance[] = [
      mkPayment(150, { period_start: "2026-04-01", period_end: "2026-04-30", payment_date: "2026-04-05" } as any),
    ];
    const arr = getUnitArrears(u, pays, new Date("2026-05-24"), "ar");
    expect(arr.unpaidCount).toBe(2);
    expect(arr.totalShortfall).toBe(250); // 50 + 200
    expect(arr.oldestUnpaid?.periodStartIso).toBe("2026-04-01");
    expect(arr.oldestUnpaid?.status).toBe("partial");
    expect(arr.cycles[1].status).toBe("unpaid");
  });

  it("returns no arrears when everything is paid", () => {
    const u = mkUnit({
      rent_amount: 80,
      rent_timing: "advance",
      contract_start_date: "2026-04-01",
      opening_balance_date: "2026-04-01",
    });
    const pays: PaymentForBalance[] = [
      mkPayment(80, { period_start: "2026-04-01", period_end: "2026-04-30" } as any),
      mkPayment(80, { period_start: "2026-05-01", period_end: "2026-05-31" } as any),
    ];
    const arr = getUnitArrears(u, pays, new Date("2026-05-24"));
    expect(arr.unpaidCount).toBe(0);
    expect(arr.oldestUnpaid).toBeNull();
  });

  it("arrears mode: current cycle not counted until it ends", () => {
    const u = mkUnit({
      rent_amount: 80,
      rent_timing: "arrears",
      contract_start_date: "2026-04-01",
      opening_balance_date: "2026-04-01",
    });
    const arr = getUnitArrears(u, [], new Date("2026-04-15"));
    expect(arr.cycles.length).toBe(0);
  });

  it("opening_balance is included as a virtual prior-arrears cycle", () => {
    // opening 100 + April partial 150/200 + May unpaid 200 = 350 across 3 unpaid cycles
    const u = mkUnit({
      rent_amount: 200,
      rent_timing: "advance",
      contract_start_date: "2026-04-01",
      opening_balance: 100,
      opening_balance_date: "2026-04-01",
    });
    const pays: PaymentForBalance[] = [
      mkPayment(150, { period_start: "2026-04-01", period_end: "2026-04-30" } as any),
    ];
    const arr = getUnitArrears(u, pays, new Date("2026-05-24"), "ar");
    expect(arr.openingBalance).toBe(100);
    expect(arr.unpaidCount).toBe(3);
    expect(arr.totalShortfall).toBe(350);
    expect(arr.oldestUnpaid?.label).toBe("متأخرات سابقة");
  });

  it("opening_balance alone with no rent still surfaces as arrears", () => {
    const u = mkUnit({
      rent_amount: 0,
      contract_start_date: "2026-04-01",
      opening_balance: 75,
      opening_balance_date: "2026-04-01",
    });
    const arr = getUnitArrears(u, [], new Date("2026-05-24"));
    expect(arr.totalShortfall).toBe(75);
    expect(arr.unpaidCount).toBe(1);
  });
});



