# Subscription & Billing Overhaul

## Part 1 — Five-tier pricing (no AI)

### New plan matrix

| Plan | Price/mo | Units | Trial | Key features |
|---|---|---|---|---|
| Free | $0 | 3 | — | Unlimited buildings, basic reports, email support |
| Personal | $9.99 | 10 | 14d | + Advanced reports, auto reminders, PDF export |
| Professional ★ | $19.99 | 25 | 14d | + Team members, auto backup, priority support |
| Business | $39.99 | 50 | 14d | + Multiple staff, advanced permissions, deeper analytics |
| Enterprise | $79.99 | 100 | 14d | + More users, dedicated support, comprehensive financials |

Yearly = monthly × 12 × 0.83 (17% off). Keep monthly/yearly toggle.

### Code/DB changes
- `src/pages/Pricing.tsx` — replace plan array with the 5 tiers above. Remove every "AI assistant" / "AI" line from features. Mark Professional as "Recommended". Show "14-day free trial" badge on each paid plan.
- DB migration — update `get_plan_unit_limit()`:
  - `personal=10`, `pro=25`, `business=50`, `enterprise=100`, default (free)=3
  - Drop the legacy `addon_units` add-on path from `user_unit_allowance()` (no per-extra-unit fee anymore — return plain `get_plan_unit_limit(user_active_plan(uid))`).
- Paddle catalog — create the new products/prices in test env via `create_product` / `create_price`:
  - `amlaki_personal` (monthly 999, yearly 9950)
  - `amlaki_pro` (monthly 1999, yearly 19900) — already exists, update amount via `api_write`
  - `amlaki_business` (monthly 3999, yearly 39850)
  - `amlaki_enterprise` (monthly 7999, yearly 79700)
- Soft upgrade nudge — in `BottomNav` / Dashboard, when `usage/limit >= 0.9`, show a small "Upgrade to {nextTier}" chip.
- Remove `BuyAddonUnitsDialog` link/usage (kept in repo for now, just unlinked).

## Part 2 — Failed-payment lifecycle (NEVER delete data)

### Stages (mapped to existing `account_phase()`)
```
active ──renews ok──▶ active
   │
   └─payment fails─▶ STAGE 1: grace (7d)        full access + banner + Paddle smart retries
                        │
                        └─7d pass─▶ STAGE 2: readonly_grace (next 23d) view-only + paused outgoing
                                       │
                                       └─30d total─▶ STAGE 3: frozen     archived, data preserved
                                                       │
                                                       └─renew──▶ active (instant restore)
```

### Logic location
- All enforcement is **server-side** via existing SECURITY DEFINER functions:
  - `can_write(uid)` already gates writes. Extend to return `false` for `readonly_grace` and `frozen`.
  - Add `frozen` phase to `account_phase()` returning `'frozen'` when 30+ days past `data_delete_at` (rename concept — never actually deletes).
  - RLS policies on `units`, `tenants`, `payments`, `tenancies`, `expenses`, `maintenance_requests`, `daily_*` already use `can_write` indirectly via writes; audit and add `can_write(auth.uid())` checks where missing on INSERT/UPDATE/DELETE policies.
- Edge functions:
  - `subscription-lifecycle` (existing cron) — extend to emit STAGE 0 reminder 3 days before `current_period_end` while subscription is `active`.
  - `payments-webhook` — on `transaction.payment_failed`, set `grace_started_at = now()` and notify. On `subscription.canceled` with past period end, set `data_delete_at = current_period_end + 30 days` (already partially done — verify and align to 30d).
  - New: pause `verify-whatsapp` outgoing flows + automatic reminder triggers when phase is `readonly_grace` or `frozen`.

### UI surface
- `GraceBanner` (exists) — extend to render 4 variants with calm copy:
  - `grace` → amber "تأخر الدفع — جدّد خلال {7-N} يوم" + "Update payment" button → customer-portal
  - `readonly_grace` → blue "وضع القراءة فقط — التذكيرات التلقائية متوقفة. جدّد لاستعادة كل شيء" + Renew button
  - `frozen` → neutral "بياناتك محفوظة بأمان. جدّد لاستعادتها فوراً" + Renew button
  - `renewal_soon` (new STAGE 0) → soft info "اشتراكك يُجدّد خلال 3 أيام"
- Disable add/edit buttons when `!can_write` (use a new `useCanWrite()` hook reading from `useSubscription` + `account_phase`). Show inline padlock with renew tooltip.
- Settings → Billing section: show current phase chip (active / grace / limited / frozen) + one-tap "Update payment method" via customer-portal.

### Auto-downgrade
- New edge function `auto-downgrade` triggered when entering `readonly_grace`: if user's unit count ≤ 3, insert a free-tier subscription row (`product_id='amlaki_free'`, `status='active'`, `environment='live'`, no `current_period_end`) and notify "تم نقلك إلى الباقة المجانية مجاناً". Otherwise leave them in read-only.

### Notifications
- All STAGE transitions and retries send: in-app `in_app_notifications` row, plus email (existing `send-transactional-email`) and WhatsApp when `whatsapp_verified_at` is set. Skip outgoing tenant reminders entirely during `readonly_grace`/`frozen`.

## Files to change
- `src/pages/Pricing.tsx`, `src/components/GraceBanner.tsx`, `src/hooks/useSubscription.ts`, `src/lib/useCanWrite.ts` (new), `src/components/SettingsPanel.tsx` or `src/pages/Settings.tsx` billing block, `src/pages/Dashboard.tsx` (near-limit nudge).
- DB migration: `get_plan_unit_limit`, `user_unit_allowance`, `account_phase` (add `frozen`), `can_write`.
- Edge fns: `subscription-lifecycle` (renewal reminder), `payments-webhook` (align grace/freeze dates), new `auto-downgrade`.
- Paddle catalog: 4 new/updated products+prices in test (auto-syncs to live on publish).

## Out of scope
- Cold/archive storage migration (data simply stays in Postgres; phase gates access). Add later only if storage cost becomes an issue.
- Mid-cycle proration on plan switches (rely on Paddle defaults).
