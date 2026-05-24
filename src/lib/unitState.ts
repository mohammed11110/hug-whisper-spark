// Recompute a unit's payment-derived state (last_paid_date, status) from the
// authoritative source = non-deleted payment rows. Called after any payment
// CRUD (insert / soft-delete / restore / purge) so the arrears badge always
// matches the actual receipts.
//
// IMPORTANT: This intentionally does NOT touch `opening_balance` or
// `opening_balance_date`. Those remain the historical opening figure; arrears
// reduction is derived dynamically by `getUnitArrears` from `payments` rows.

import { supabase } from "@/integrations/supabase/client";
import { getUnitArrears } from "@/lib/balance";

export async function recomputeUnitStateFromPayments(unitId: string): Promise<void> {
  if (!unitId) return;

  const [{ data: unit }, { data: pays }] = await Promise.all([
    supabase
      .from("units")
      .select(
        "id, rent_amount, rent_type, rent_timing, contract_start_date, opening_balance, opening_balance_date, due_day",
      )
      .eq("id", unitId)
      .maybeSingle(),
    supabase
      .from("payments")
      .select("unit_id, amount, deleted_at, payment_date, period_start, period_end")
      .eq("unit_id", unitId)
      .is("deleted_at", null),
  ]);

  if (!unit) return;

  const livePays = (pays || []) as any[];

  // Latest payment_date among non-deleted rows.
  const latestDate = livePays
    .map((p) => p.payment_date)
    .filter(Boolean)
    .sort()
    .pop() as string | null | undefined;

  // Derive status from current arrears.
  const arr = getUnitArrears(unit as any, livePays as any, new Date());
  let status: "paid" | "late" | "soon" = "paid";
  if (arr.totalShortfall > 0.009) {
    status = "late";
  } else if (livePays.length === 0) {
    // No payments yet: keep "soon" so newly created units don't flip to paid.
    status = "soon";
  }

  await supabase
    .from("units")
    .update({ last_paid_date: latestDate ?? null, status })
    .eq("id", unitId);
}
