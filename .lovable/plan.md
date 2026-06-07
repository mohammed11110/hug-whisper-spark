## Goal

When a user ends a lease whose active balance is > 0, force them to pick one of three resolutions before the lease closes. Persist the choice on the lease so the unit's active account never inherits it and so it can be followed up later from a "Previous balances / ذمم سابقة" list.

## Database (one migration)

Add to `public.tenancies`:

- `debt_resolution text` — one of `kept` | `collected` | `written_off` | `none` (NULL until ended; `none` when `outstanding_at_end = 0`).
- `debt_settled boolean NOT NULL DEFAULT false` — true after a "kept" debt is later marked paid/cleared.
- `debt_settled_at timestamptz NULL`.
- `write_off_amount numeric NULL`, `write_off_reason text NULL` — required when resolution = `written_off`.
- `closing_balance numeric NULL` — snapshot of arrears at eviction (mirrors `outstanding_at_end` but never recomputed; the source of truth for the previous-balances view).

Index: `CREATE INDEX idx_tenancies_open_debt ON public.tenancies (building_id) WHERE status='ended' AND debt_settled = false AND COALESCE(closing_balance,0) > 0;`

No RLS / GRANT changes (table already configured).

## Eviction dialog (`src/components/EndTenancyDialog.tsx`)

Replace the existing two-option "carry / settle" radio with a Midnight & Gold resolution card that appears **only when `outstanding > 0`**. Three choices, single select, mandatory:

```text
┌─ Outstanding balance ─────────  ٢٢٠٫٠٠٠ OMR ─┐
│ ◉  Keep as debt on tenant   (recommended)    │
│    Closes the lease; debt stays visible      │
│    under Previous balances. Won't follow     │
│    the unit or the next tenant.              │
│ ○  Mark as collected now                     │
│    Opens AddPaymentDialog pre-filled to       │
│    clear the full balance, then closes lease.│
│ ○  Write off (settlement)                    │
│    Requires a reason. Logged as a            │
│    deliberate waiver.                        │
└──────────────────────────────────────────────┘
```

Behavior per choice:

- **kept** — submit closes the lease with `debt_resolution='kept'`, `closing_balance=outstanding`, `outstanding_at_end=outstanding`, `debt_settled=false`. No payment / adjustment rows written.
- **collected** — submit is disabled until the user clicks "Record payment". That opens `AddPaymentDialog` with `presetUnitId=unit.id`, amount pre-filled to `outstanding`, allocation auto = arrears. After it saves and `paymentsBus` fires, the dialog re-reads the balance; once it's zero, the closing flow runs with `debt_resolution='collected'`, `closing_balance=0`.
- **written_off** — show a required `Textarea` ("Reason / السبب", min 4 chars). On submit, insert one `payments` row: `tenancy_id=active`, `unit_id`, `kind='adjustment'`, `amount=+outstanding` (positive = credit), `notes='Write-off — '+reason`, `payment_date=endDate`. Then close lease with `debt_resolution='written_off'`, `write_off_amount=outstanding`, `write_off_reason=reason`, `closing_balance=0`, `outstanding_at_end=0`.

Submit is blocked while `outstanding > 0` and no resolution is chosen (or chosen=collected with balance still > 0, or chosen=written_off with empty reason).

`logActivity` payload gains `debt_resolution`, `closing_balance`, `write_off_reason` when applicable. Description uses the resolution label bilingually.

Design tokens: outstanding amount in `text-burgundy` (light) / `text-danger` (dark); the resolution card uses the midnight + gold signature surface; selected radio = gold ring; "recommended" pill in gold.

## Statement & active-balance integrity (already lease-scoped)

`getUnitArrears` and the per-lease statement already filter by `tenancy_id`. With the new fields the only change is **display**:

- In the unit statement PDF (`exportStatement` in `src/pages/UnitDetail.tsx`), under the previous-tenant block header, add a small pill:
  - `kept` → "Outstanding debt: 220 OMR / دين قائم"
  - `collected` → "Cleared at eviction / مُسدّد عند الإخلاء"
  - `written_off` → "Written off — reason / مشطوب — السبب"
- Eviction divider keeps the existing design.

The new lease's running balance still starts at 0 because the kept debt lives on the previous `tenancy_id` only and never re-enters the new lease's payments query.

## New "Previous balances" view

Add `src/pages/PreviousBalances.tsx` and route `/previous-balances` (linked from Tenants page header and from the unit's Lease History card when an ended lease has `debt_resolution='kept'` and `debt_settled=false`).

List items grouped by building → unit, each showing: tenant name, contract number, ended date, `closing_balance`, days since eviction. Row actions:

- **Mark as collected** — opens `AddPaymentDialog` in a special "former-tenant" mode that writes a payment row with `tenancy_id = ended lease id`, `kind='rent'`, `notes='Former-tenant arrears collection'`. On success sets `debt_settled=true`, `debt_settled_at=now()`.
- **Write off** — same write-off flow as in the eviction dialog (reason required), flips `debt_resolution='written_off'`, `debt_settled=true`.
- **View statement** — jumps to the unit statement PDF.

`AddPaymentDialog` needs a small extension: accept an optional `tenancyIdOverride` prop. When set, it skips the "active tenancy" lookup and writes the row with that `tenancy_id` (still scoped to the unit). Cycle key in the dialog already groups by lease so receipt numbering remains correct.

## Bilingual strings (`src/lib/i18n2.tsx`)

Add keys: `outstanding_resolution`, `res_keep_debt`, `res_keep_debt_desc`, `res_collect_now`, `res_collect_now_desc`, `res_write_off`, `res_write_off_desc`, `recommended`, `write_off_reason`, `write_off_reason_required`, `record_payment`, `previous_balances`, `previous_balances_empty`, `former_tenant_debt`, `cleared_at_eviction`, `written_off_short`, `mark_collected`, `days_since_eviction`.

## Files to change

- `supabase/migrations/<ts>_tenancy_debt_resolution.sql` (new) — schema only.
- `src/components/EndTenancyDialog.tsx` — replace radio block, add reason field, gate submit, call `AddPaymentDialog` for collect-now, write payments row for write-off, persist new lease fields.
- `src/components/AddPaymentDialog.tsx` — accept `tenancyIdOverride`, default amount/notes, hide period picker when in former-tenant mode.
- `src/pages/UnitDetail.tsx` — pass `tenancyIdOverride` from Lease History row, render resolution pill in previous-tenant block, link to Previous Balances.
- `src/lib/pdfDocs.ts` / `pdfDocsLazy.ts` — render the resolution pill inside the previous-tenant header band.
- `src/pages/PreviousBalances.tsx` (new) + route registration in `src/App.tsx`.
- `src/pages/Tenants.tsx` — header link "Previous balances".
- `src/lib/i18n2.tsx` — new keys.
- `src/lib/activityLogger.ts` usage already covers the new fields via `changes`.

## Out of scope

- No change to `recompute_unit_state` or `getUnitArrears` logic (they already scope by active `tenancy_id`).
- No change to receipt numbering — the write-off uses `kind='adjustment'` (no receipt number); the collect-now path goes through the normal `AddPaymentDialog` which already handles `/1`, `/2`, `/D` correctly per lease.
- No notification / WhatsApp template changes in this task.
