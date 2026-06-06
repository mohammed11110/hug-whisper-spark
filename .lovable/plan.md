## Goal

When a user registers a lease whose **contract_start_date is before today**, force them to declare what happened in the months before they joined the app. This prevents the balance engine from generating fake arrears for the entire backdated period.

If the contract start is today or in the future → nothing changes, no prompt.

## Where it applies

The same handler is added in both lease-creation entry points:

1. `src/components/NewTenancyDialog.tsx` — new tenant on an existing unit.
2. `src/components/AddUnitDialog.tsx` — unit created already occupied (same backdated case).

Edit flows (`EditUnitDialog`) are NOT touched — backdated logic only runs at registration, exactly as the existing memory rule states.

## Trigger

```
contract_start_date < today  →  show the BackdatedContractCard (non-skippable)
contract_start_date >= today →  no card, save normally
```

The save button is **disabled** until the user picks one of the three options.

## UI — BackdatedContractCard (new component)

Style: **Midnight & Gold signature card** (`bg-midnight`, gold accent, `text-gold-bright`), matches the brand thread for hero/signature surfaces in both light & dark mode. Inserted right under the contract dates row.

Structure:

```text
┌─────────────────────────────────────────────┐
│ ⚠ Backdated contract                        │
│ This contract started [12 Jan 2026], before │
│ you began using the app. Tell us about the  │
│ previous months to avoid wrong arrears.     │
│                                             │
│ ◯ All previous months were paid             │
│ ◯ Some months are unpaid                    │
│     └─ [ first unpaid month ▼ ]             │
│ ◯ Enter prior balance manually              │
│     └─ [ amount input ] OMR                 │
│                                             │
│ ─────────── Live preview ───────────        │
│ Ignored period:    Jan – May 2026           │
│ First month counted: Jun 2026               │
│ Arrears right now:   ✓ 0.000 OMR  (gold)    │
│ Current month due:   120.000 OMR            │
└─────────────────────────────────────────────┘
```

Fully bilingual (AR/EN) and RTL-aware. Uses existing semantic tokens — no raw hex.

## Mapping the three options onto existing DB fields

The schema already has every field we need (`tenancies.paid_up_to`, `units.opening_balance`, `units.opening_balance_date`, `units.paid_up_to`). No migration required.

| Option chosen | `contract_start_date` | `paid_up_to` | `opening_balance` | `opening_balance_date` |
|---|---|---|---|---|
| **1. All previous months paid** | real lease start | last day of the month BEFORE today's cycle | 0 | null |
| **2. Some months unpaid** (user picks first unpaid month M) | real lease start | last day of month (M − 1) | 0 | first day of month M (anchored to due_day) |
| **3. Manual prior balance** (amount A) | real lease start | null | A | `contract_start_date` |

This reuses the exact semantics already implemented in `src/lib/balance.ts` — `getAnchorDate()` already prefers `paid_up_to` (day +1) over `opening_balance_date` over `contract_start_date`, and `getUnitArrears()` already skips anything before the anchor. So the balance engine needs **zero changes** — only the dialogs feed it the right anchor.

The "manual prior balance" path keeps the existing distribution logic (the `arrears` field already there in `NewTenancyDialog`) but the input lives inside the new card and the legacy free-text "متأخرات يدوية" entry is hidden when the backdated card is showing, to remove the duplicate.

## Live preview

A small `useMemo` derives, from the current option + inputs:

- `ignoredPeriod` — human label from `contract_start_date` to the day before the anchor (empty for option 1 if anchor = current cycle start).
- `firstMonthCounted` — first cycle the engine will accrue (from `getAnchorDate` + `getCycleByStartMonth`).
- `arrearsRightNow` — calls `getUnitArrears({...formValues})` against an empty payments array, formatted as `Number(x).toFixed(3)` (same fix as the receipt PDF) and shown in:
  - `text-gold-bright` / green tone when `= 0`,
  - amber when `> 0`.
- `currentMonthDue` — from `getNextDueInfo({...formValues})`.

All four lines update live as the user toggles options or changes the month/amount.

## Validation

- Save button disabled while no option selected.
- Option 2: month picker required; cannot be ≥ today's cycle (collapses to option 1).
- Option 3: amount required, must be ≥ 0.
- Switching options resets the other options' inputs, so we never persist stale data.

## Files changed

- `src/components/BackdatedContractCard.tsx` — **new** presentational + state component.
- `src/components/NewTenancyDialog.tsx` — mount the card under the dates row, replace direct writes of `paid_up_to` / `opening_balance` / `opening_balance_date` with the card's resolved values, gate the submit button.
- `src/components/AddUnitDialog.tsx` — same integration as above for the "occupied at creation" path.
- `src/lib/i18n2.tsx` — add ~10 AR/EN strings for the card (title, body, three option labels, the four preview labels).

No database migration. No changes to `src/lib/balance.ts`, `src/lib/receiptNumbering.ts`, edge functions, or the receipt PDF.

## Result

A user importing a 2-year-old contract today and choosing "all previous months were paid" sees `Arrears: 0.000 OMR` immediately, with the first counted cycle being the current month — the running balance starts exactly where they say it does.
