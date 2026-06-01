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
