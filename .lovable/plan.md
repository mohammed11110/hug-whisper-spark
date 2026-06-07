# Fix: Dashboard shows all units as rented

## Root cause
Dashboard determines occupancy with `u.status !== "vacant"`, but the `units.status` column in this project never holds the value `"vacant"` — it only holds rent-state values (`paid`, `soon`, `upcoming`, `critical`, …). Vacancy is actually represented by `tenant_name IS NULL`.

Current DB confirms this: 38 units have no tenant (vacant) yet all carry `status='soon'`, so Dashboard counts every unit as rented and reports vacant = 0.

## Fix
Treat a unit as occupied **iff it has a `tenant_name`** (matches how the rest of the app, e.g. arrears calculation, already works).

### `src/pages/Dashboard.tsx`
- Change the occupied filter (around line 80) from `u.status !== "vacant"` to `!!u.tenant_name`.
- `stats.tenants` then equals `occupied.length`, so keep one source of truth.
- `rented` / `vacant` subtitle on the Units stat card will then display correctly.

### `src/pages/Buildings.tsx` (same bug, same page family)
- In `load()` (around line 78): replace `u.status !== "vacant"` with `!!u.tenant_name` when computing `occupied` and `hasArrears` (arrears uses a different signal — keep that as-is, only fix occupancy).
- Select `tenant_name, status` on the units query so the new check has the field available.

## Out of scope
- No schema change, no migration. `status` keeps its current rent-state semantics everywhere else.
- Other screens that already use tenant presence / active tenancy are unaffected.

## Verification
- Reload `/` — Units card subtitle should read `32 مؤجرة · 38 شاغرة` (matches DB).
- `/buildings` KPI bar Occupancy % should drop from 100% to the real ratio, and per-building "occupied" chips should match.
