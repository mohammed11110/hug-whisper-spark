import { formatReceipt, type ReceiptNumbering } from "./appSettings";

/**
 * Receipt numbering with partial-payment suffixes:
 *  - Full payment from the first try     → "R-01050"
 *  - First partial payment of a cycle    → "R-01024/1"
 *  - Next partial payments of same cycle → "R-01024/2", "R-01024/3"...
 *  - Final payment that closes a split   → "R-01024/D"
 *
 * Suffixes are scoped per cycle = (unit_id + period_start + period_end).
 * The "base" number stays identical across all installments of a cycle so
 * the unit's account statement can naturally group them together.
 */

export interface CyclePaymentRef {
  amount: number;
  expected_amount: number | null;
  receipt_number: string | null;
}

export interface ComputeReceiptArgs {
  receipt: ReceiptNumbering;
  /** Counter to use if a NEW base number is needed (caller advances between rows). */
  nextCounter: number;
  rowAmount: number;
  rowExpected: number | null;
  /** Prior non-deleted payments for the same (unit, period) — excluding this row. */
  priorInCycle: CyclePaymentRef[];
  /** Optional explicit override from user input. Used only when it's clearly a custom value. */
  userOverride?: string | null;
}

export interface ComputeReceiptResult {
  receiptNumber: string;
  /** True when a new base number was consumed (caller should advance its counter). */
  consumesNewNumber: boolean;
  isPartial: boolean;
  isFinal: boolean;
}

/** Extract the base part of a receipt number (everything before the first "/"). */
export function baseOf(receiptNumber: string | null | undefined): string {
  if (!receiptNumber) return "";
  const i = receiptNumber.indexOf("/");
  return i === -1 ? receiptNumber : receiptNumber.slice(0, i);
}

/** Extract the suffix ("1", "2", "D") or null if none. */
export function suffixOf(receiptNumber: string | null | undefined): string | null {
  if (!receiptNumber) return null;
  const i = receiptNumber.indexOf("/");
  if (i === -1) return null;
  return receiptNumber.slice(i + 1);
}

export function isPartialSuffix(suffix: string | null): boolean {
  return !!suffix && /^\d+$/.test(suffix);
}

export function isFinalSuffix(suffix: string | null): boolean {
  return suffix === "D";
}

export function computeReceiptNumber({
  receipt,
  nextCounter,
  rowAmount,
  rowExpected,
  priorInCycle,
  userOverride,
}: ComputeReceiptArgs): ComputeReceiptResult {
  const sumBefore = priorInCycle.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const cycleDue = (() => {
    if (rowExpected && rowExpected > 0) return rowExpected;
    const prevExpected = priorInCycle.find((p) => p.expected_amount && p.expected_amount > 0)
      ?.expected_amount;
    if (prevExpected && prevExpected > 0) return prevExpected;
    // No declared cycle due → treat this row as self-closing.
    return sumBefore + rowAmount;
  })();
  const willClose = sumBefore + rowAmount >= cycleDue - 0.009;
  const isFirstInCycle = priorInCycle.length === 0;

  if (isFirstInCycle) {
    const baseNumber = userOverride && userOverride.length > 0
      ? userOverride
      : formatReceipt(receipt, nextCounter);
    const consumesNewNumber = !userOverride;
    if (willClose) {
      return { receiptNumber: baseNumber, consumesNewNumber, isPartial: false, isFinal: false };
    }
    return {
      receiptNumber: `${baseNumber}/1`,
      consumesNewNumber,
      isPartial: true,
      isFinal: false,
    };
  }

  // Subsequent installment for the same cycle — reuse the base from the first one.
  const firstWithReceipt = priorInCycle
    .map((p) => baseOf(p.receipt_number))
    .find((b) => b.length > 0);
  const baseFromPrior = firstWithReceipt || formatReceipt(receipt, nextCounter);
  const partialsCount = priorInCycle.filter((p) => isPartialSuffix(suffixOf(p.receipt_number))).length;

  if (willClose) {
    return {
      receiptNumber: `${baseFromPrior}/D`,
      consumesNewNumber: false,
      isPartial: false,
      isFinal: true,
    };
  }
  return {
    receiptNumber: `${baseFromPrior}/${partialsCount + 1}`,
    consumesNewNumber: false,
    isPartial: true,
    isFinal: false,
  };
}

/* -------------------------------------------------------------------------- */
/*                  Display-time derivation for legacy receipts               */
/* -------------------------------------------------------------------------- */

/**
 * Given a unit's payments, derives a per-payment view of partial-cycle
 * metadata WITHOUT mutating any stored `receipt_number`. Used by the unit
 * statement and the payments list to retroactively present old receipts as
 * if they had been issued under the new `/1`, `/2`, `/D` system.
 *
 * - If a payment already has a stored suffix (`/1`, `/2`, `/D`), it is kept
 *   as-is and `isComputed = false`.
 * - Otherwise, suffixes are computed within each cycle group
 *   (`unit_id + period_start + period_end`) ordered by `payment_date` then
 *   `created_at`. `isComputed = true` so the UI can show a small "computed"
 *   hint next to the suffix.
 * - Cycles that already have only one payment which fully covers
 *   `expected_amount` get NO suffix — exactly like a brand-new full receipt.
 */
export interface DerivablePayment {
  id: string;
  unit_id?: string | null;
  tenancy_id?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  payment_date?: string | null;
  created_at?: string | null;
  amount: number;
  expected_amount?: number | null;
  receipt_number?: string | null;
  kind?: string | null;
  deleted_at?: string | null;
}

export interface DerivedPartialMeta {
  /** "1" | "2" | "D" | null */
  derivedSuffix: string | null;
  /** True when the suffix was derived (not stored on receipt_number). */
  isComputed: boolean;
  /** Group key (unit_id|period_start|period_end). Empty when the payment
   *  has no cycle (e.g. ad-hoc adjustment) — no grouping in that case. */
  cycleKey: string;
  /** Remaining amount on the cycle after this payment, never below zero. */
  cycleRemaining: number;
  /** True if this payment closes the cycle (or the cycle is fully paid). */
  cycleClosed: boolean;
  /** Index of this payment within the cycle (1-based). */
  positionInCycle: number;
  /** Number of installments in the cycle (including this one). */
  cycleSize: number;
}

export function derivePartialMetaForDisplay(
  payments: DerivablePayment[],
  opts?: { activeTenancyIds?: Set<string> }
): Map<string, DerivedPartialMeta> {
  const result = new Map<string, DerivedPartialMeta>();
  const active = opts?.activeTenancyIds;

  // Bucket non-deleted, non-adjustment payments by cycle key.
  const groups = new Map<string, DerivablePayment[]>();
  for (const p of payments) {
    if (p.deleted_at) continue;
    if ((p.kind || "rent") === "adjustment" || (p.kind || "rent") === "opening") continue;
    if (!p.period_start || !p.period_end || !p.unit_id) {
      result.set(p.id, {
        derivedSuffix: suffixOf(p.receipt_number),
        isComputed: false,
        cycleKey: "",
        cycleRemaining: 0,
        cycleClosed: true,
        positionInCycle: 1,
        cycleSize: 1,
      });
      continue;
    }
    // Restrict grouping to active-tenancy payments when caller asked.
    if (active && p.tenancy_id && !active.has(p.tenancy_id)) {
      result.set(p.id, {
        derivedSuffix: suffixOf(p.receipt_number),
        isComputed: false,
        cycleKey: "",
        cycleRemaining: 0,
        cycleClosed: true,
        positionInCycle: 1,
        cycleSize: 1,
      });
      continue;
    }
    const key = `${p.unit_id}|${p.period_start}|${p.period_end}`;
    const arr = groups.get(key) || [];
    arr.push(p);
    groups.set(key, arr);
  }

  for (const [cycleKey, list] of groups) {
    list.sort((a, b) => {
      const ad = (a.payment_date || "") + (a.created_at || "");
      const bd = (b.payment_date || "") + (b.created_at || "");
      return ad.localeCompare(bd);
    });
    const cycleDue =
      list.find((p) => p.expected_amount && (p.expected_amount as number) > 0)
        ?.expected_amount || list.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    let running = 0;
    let partialIndex = 0;
    list.forEach((p, idx) => {
      running += Number(p.amount) || 0;
      const willClose = running >= (cycleDue as number) - 0.009;
      const storedSfx = suffixOf(p.receipt_number);
      let derivedSuffix: string | null = null;
      let isComputed = false;
      if (storedSfx) {
        derivedSuffix = storedSfx;
        isComputed = false;
        if (isPartialSuffix(storedSfx)) partialIndex++;
      } else if (list.length === 1 && willClose) {
        derivedSuffix = null;
        isComputed = false;
      } else if (willClose) {
        derivedSuffix = "D";
        isComputed = true;
      } else {
        partialIndex++;
        derivedSuffix = String(partialIndex);
        isComputed = true;
      }
      result.set(p.id, {
        derivedSuffix,
        isComputed,
        cycleKey,
        cycleRemaining: Math.max(0, (cycleDue as number) - running),
        cycleClosed: willClose,
        positionInCycle: idx + 1,
        cycleSize: list.length,
      });
    });
  }

  // Any payment not yet visited (e.g. deleted/adjustment) gets a passthrough.
  for (const p of payments) {
    if (!result.has(p.id)) {
      result.set(p.id, {
        derivedSuffix: suffixOf(p.receipt_number),
        isComputed: false,
        cycleKey: "",
        cycleRemaining: 0,
        cycleClosed: true,
        positionInCycle: 1,
        cycleSize: 1,
      });
    }
  }
  return result;
}

