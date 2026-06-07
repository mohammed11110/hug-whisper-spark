# Fix tenant-mixing in Unit Account & Statement

Two problems, one root cause: charges/payments are scoped to the **unit**, not the **lease (tenancy)**. After eviction + new tenant, both histories are summed together, and the statement PDF mixes them in one continuous balance.

---

## 1. Data integrity — guarantee `tenancy_id` on every payment

A migration (separate approval step) will:

- **Backfill** `payments.tenancy_id` for legacy rows where it is `NULL`, by matching `unit_id` + `payment_date` against `tenancies(contract_start_date, ended_at/contract_end_date)`. Prefer the tenancy whose period contains `payment_date`; fall back to the most recent ended tenancy when the active one doesn't match.
- **Backfill** `opening` kind rows similarly (they belong to the tenancy that owns the opening balance).
- Once backfilled, leave the existing `payments_autofill_tenancy` trigger in place — it already sets `tenancy_id` for new inserts. (No `NOT NULL` constraint yet; we keep the fallback-by-date filter in `balance.ts` as a safety net for any straggler.)

No schema change beyond a one-shot `UPDATE` and a partial index on `payments(unit_id, tenancy_id)` if planning shows it helps.

---

## 2. Account Summary card = active lease only

In `src/lib/balance.ts → getUnitArrears`:

- When `activeTenancyId` is provided, **strictly** require `p.tenancy_id === activeTenancyId`. Drop the "NULL tenancy_id passes the date cutoff" fallback path inside this branch — after backfill, NULL means "belongs to no active lease, ignore". (Fallback retained only when `activeTenancyId` is null, i.e. vacant unit.)
- Build a **virtual `UnitForBalance`** from the active tenancy row (rent_amount, contract_start_date, contract_end_date, due_day, opening_balance, opening_balance_date, paid_up_to, rent_type, rent_timing, grace_days) rather than from the `units` table. This means the active card never sees a stale `unit.opening_balance` left from a prior tenant.

In `src/pages/UnitDetail.tsx`:

- `DetailsTab` already receives `activeTenancyId`; switch the `getUnitArrears(unit, ...)` call to use the active tenancy as the unit shape (helper `tenancyToUnitShape(tenancy)`).
- `ArrearsBadge`, `UnitHealthBadge`, `LeaseHistoryCard` get the same helper so each lease card uses its own anchors.
- `EditPaymentDialog` already passes `activeTenancyId` — keep, but feed it the tenancy-shape too.

No UI redesign on the unit screen — just correct numbers.

---

## 3. Statement PDF — redesigned, grouped by lease

### Data build (in `src/pages/UnitDetail.tsx → exportStatement`)

1. Load all `tenancies` for the unit + all non-deleted `payments` (already done).
2. Group payments by `tenancy_id`; legacy `NULL`s are bucketed by date into the matching tenancy (same logic as the migration backfill).
3. For each tenancy, build its own entry stream:
   - Opening balance row (from `tenancy.opening_balance` + `opening_balance_date`).
   - Monthly/quarterly/yearly rent charges from `tenancy.contract_start_date` to `min(tenancy.ended_at || contract_end_date, today)` using the tenancy's `rent_type` and start day (re-use the period generator from `BackdatedContractCard`).
   - Payment rows for that tenancy.
   - Running balance **starts at 0** and accrues only within the block.
4. Per-tenant totals: `totalCharges`, `totalPaid`, `closingBalance` (= `outstanding_at_end` for ended leases, current arrears for the active one).
5. Sort tenancies oldest → newest. Tag the last one **"Current tenant / المستأجر الحالي"** (gold), the rest **"Previous tenant / مستأجر سابق"** (muted).

### Rendering (in `src/lib/pdfDocs.ts`)

Replace `createTenantStatementPDFDirect` data shape with `UnitStatementData { unit, brand, currency, leases: LeaseBlock[] }` and add a new exporter `downloadUnitStatementPDFDirect`. Keep the old tenant-statement entry point for any other caller.

For each `LeaseBlock` in order:

1. **Lease header band** — full-width rounded card, Midnight bg with Gold accent:
   - Left: status tag (`Current` gold-filled / `Previous` muted-outline), tenant name (AR + EN).
   - Right: contract period `start – end`, rent amount, contract number if any.
2. **Transactions table** — existing `ddTable` with columns: Date, Description, Charge, Payment, Balance (running, resets at 0 for this block).
3. **Per-tenant summary** — `ddSummary` with Total charged / Total paid / Block balance (red if > 0, sage if ≤ 0).
4. **Eviction divider** (only between blocks, after a `Previous` block):
   - Full-width dashed horizontal rule in terracotta `#a85d5d` (light) / will print as solid mid-red on white PDF page.
   - Centered pill label: `⊗ Vacated — DD/M/YYYY  ·  تم الإخلاء — DD/M/YYYY` in terracotta on cream.
   - Use `pdf.setLineDashPattern([2, 2], 0)` then reset.
5. Page-break safety: each lease block calls `ensureSpace(ctx, minBlockHeight)`; eviction divider never orphans at page top.

Header of the whole document stays: brand, unit number, building, generation date. Title becomes **"كشف حساب الوحدة / Unit Statement"**.

### Bilingual / RTL

Keep the existing `rtl = true` ctx and dual-language labels (Arabic first, English second), matching the rest of the PDF suite. Period dates formatted `D/M/YYYY` with no leading zeros via existing `formatDate`.

---

## Files changed

- `supabase/migrations/<new>.sql` — backfill `payments.tenancy_id` (migration tool, separate approval).
- `src/lib/balance.ts` — tighten `activeTenancyId` filter; export `tenancyToUnitShape` helper.
- `src/pages/UnitDetail.tsx` — use tenancy shape for arrears; rebuild `exportStatement` to produce grouped lease blocks.
- `src/lib/pdfDocs.ts` — add `UnitStatementData`, `createUnitStatementPDFDirect`, `downloadUnitStatementPDFDirect`; add helpers for lease header band, eviction divider, status tag.
- Re-use existing period generator from `BackdatedContractCard` (extract to `src/lib/balance.ts` if needed).

## Out of scope

- `EditUnitDialog` / `NewTenancyDialog` flows — unchanged.
- Receipts and lease contract PDFs — unchanged.
- Payments page filtering — already lease-aware.
- No DB schema change beyond a one-shot `UPDATE`.
