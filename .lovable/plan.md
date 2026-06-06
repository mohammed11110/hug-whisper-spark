## Goal

Improve the "Some months are unpaid" option in `BackdatedContractCard` so the user picks the first unpaid month from a **visual list of the contract's real billing periods** — anchored on the contract's actual start DAY, not the 1st of the month — instead of a generic month dropdown.

## Behavior

1. **Generate the period list** from the form values currently passed to the card:
   - Start: `contract_start_date` (e.g. 2026-01-10).
   - End: `min(contract_end_date, today)` — future periods are never "unpaid yet".
   - Step depends on `rent_type` / contract billing cycle:
     - `monthly` → +1 month (default).
     - `yearly` → +12 months.
     - `daily` → fall back to a single "before today" row (daily contracts don't have unpaid months semantically).
   - Each row = `{ index, start, end }` where `end = nextStart − 1 day`.
   - Format periods as `D/M/YYYY – D/M/YYYY` (no leading zeros), e.g. `10/4 – 9/5/2026`. Year is shown once on the end side when both dates share the same year.

2. **Pass `contract_end_date` and `rent_type` cycle into the card.** The card currently only knows `rent_type`; add an optional `contractEndDate` prop and accept the existing `rentType` for the cycle step.

3. **Tappable list UI** (Midnight & Gold, matches existing card styling):
   - Vertical scrollable list (`max-h-72 overflow-y-auto`, custom gold scrollbar via existing utility classes).
   - Each row shows:
     - Left: `#N` badge (gold ring on dark) + period label.
     - Right: status pill that updates live based on the currently tapped row:
       - rows before tapped → `Paid` (success green token-equivalent on midnight: `#7ed9a8` / `bg-emerald-500/15`).
       - tapped row → `First unpaid` (gold `#c9a44c`, filled).
       - rows after tapped → `Will be counted` (warning red on midnight: `#e09a9a` / `bg-red-500/15`).
   - Before any tap, every row shows a neutral muted `—` pill so the user understands they must pick one.
   - Tapping a row sets `firstUnpaidIndex`. The whole list re-styles instantly.

4. **Resolution mapping** (replaces the current `firstUnpaidMonth: "YYYY-MM"` value):
   - `arrears_start_date` = start ISO of the tapped period.
   - Persisted fields stay identical to today's contract — only the source changes:
     - `paid_up_to` = `arrears_start_date − 1 day` (ISO).
     - `opening_balance` = 0, `opening_balance_date` = null.
   - Returned shape becomes:
     ```ts
     { kind: "some_unpaid", paidUpTo, arrearsStartDate, firstUnpaidIndex, openingBalance: 0, openingBalanceDate: null }
     ```
     Existing callers (`NewTenancyDialog`, `AddUnitDialog`) only read `paidUpTo` / `openingBalance` / `openingBalanceDate`, so they don't change.

5. **Live preview** (updates the existing preview block when option 2 is active):
   - `Paid periods` → e.g. `Months 1–3 · 10/1 – 9/4/2026` (omit if none).
   - `Arrears start` → `10/4/2026`.
   - `Arrears now` → calls the existing `getUnitArrears` against the virtual unit (already wired) and shows `value OMR (N months)`, where N = number of full cycles between `arrearsStartDate` and today using `periodsElapsed` + the timing rule.
   - Keeps the existing `Current month due` row for continuity.

6. **Bilingual + RTL** — every label routed through the existing AR/EN branches inside the card. Period numerals stay Western digits (matches existing receipt formatting in the project).

## Files to change

- `src/components/BackdatedContractCard.tsx`
  - Add `contractEndDate?: string` prop.
  - Replace the `cycleOptions` month list + `<Select>` with a `periods` array (date-day-anchored) and the tappable list UI described above.
  - Update `BackdatedResolution["some_unpaid"]` to carry `arrearsStartDate` and `firstUnpaidIndex` (still backward-compatible — `paidUpTo` is the field consumed downstream).
  - Extend the preview block with the "Paid periods" line and the `(N months)` suffix on arrears.
- `src/components/NewTenancyDialog.tsx` — pass `contractEndDate={endDate}` to the card.
- `src/components/AddUnitDialog.tsx` — pass `contractEndDate={endDate}` to the card (same prop name).
- `.lovable/plan.md` — append a short note documenting the period-list UX (the surrounding architecture in that doc stays accurate).

## Non-changes

- No DB migration. No edits to `src/lib/balance.ts` — `getUnitArrears` already accrues from the anchor (`paid_up_to + 1`), which is exactly `arrears_start_date`.
- No edits to receipts, edge functions, or `EditUnitDialog` (backdated handling is registration-only, per existing memory).
- The other two options (`all_paid`, `manual`) are untouched.

## Result

For a contract `10/1/2026 → 10/1/2027`, today = `15/5/2026`, tapping period #4 (`10/4 – 9/5/2026`) sets `arrears_start_date = 2026-04-10`, marks periods 1–3 as paid, and the live preview shows e.g. `Paid: Months 1–3 · 10/1 – 9/4/2026`, `Arrears start: 10/4/2026`, `Arrears now: 220.000 OMR (2 months)`. The running-balance engine then accrues only from `10/4/2026` onward, using the real contract billing days.
