// Unified financial balance helper for a unit.
// Balance = opening_balance + accrued rent since contract/opening start − payments received.

export interface UnitForBalance {
  id: string;
  rent_amount: number | string;
  rent_type: string; // monthly | daily | yearly
  contract_start_date?: string | null;
  opening_balance?: number | string | null;
  opening_balance_date?: string | null;
}

export interface PaymentForBalance {
  unit_id: string;
  amount: number | string;
  deleted_at?: string | null;
}

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
  // monthly (default)
  let m = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) m -= 1;
  return Math.max(0, m);
}

export function computeBalance(unit: UnitForBalance, payments: PaymentForBalance[]) {
  const rent = num(unit.rent_amount);
  const opening = num(unit.opening_balance);
  const startStr = unit.opening_balance_date || unit.contract_start_date || null;
  const start = startStr ? new Date(startStr) : null;
  const now = new Date();

  const periods = start ? periodsElapsed(start, now, unit.rent_type) : 0;
  const accrued = rent * periods;
  const totalDue = opening + accrued;

  const paid = payments
    .filter((p) => p.unit_id === unit.id && !p.deleted_at)
    .reduce((s, p) => s + num(p.amount), 0);

  const outstanding = Math.max(0, totalDue - paid);
  return { opening, accrued, totalDue, paid, outstanding };
}
