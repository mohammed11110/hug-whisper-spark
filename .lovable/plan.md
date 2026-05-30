# Subscription Cancellation & Data Retention

A three-phase lifecycle that respects the paid period, gives users 30 days of read-only access + export, then permanently deletes their data unless they reactivate.

## Lifecycle

```text
ACTIVE ──cancel──► CANCELED (still paid)
                       │ period_end reached
                       ▼
                    GRACE (30 days, read-only, export + reactivate)
                       │ data_delete_at reached, no reactivation
                       ▼
                    DELETED (data permanently removed)
```

Reactivate at any point before deletion → instant return to ACTIVE.

## 1. Database

Migration on `public.subscriptions`:
- `canceled_at timestamptz` — set when user cancels.
- `data_delete_at timestamptz` — set to `current_period_end + 30 days` when entering grace.
- `status` already exists; we add two app-level meanings: `'grace'` and `'deleted'`. Paddle still sends `canceled`; our webhook + a scheduled job promote it to `grace` / `deleted`.
- `reactivated_at timestamptz` — audit trail.

New SQL helper `public.subscription_phase(user_id)` returns `'active' | 'canceled' | 'grace' | 'deleted' | 'free'` so client + RLS both use one source of truth.

Update `has_active_subscription` to treat `grace` as **not** active (so paid features lock), but a new `public.has_data_access(user_id)` returns true for `active | canceled | grace` (used by SELECT / export paths).

## 2. RLS — read-only enforcement in grace

For each user-owned data table (`buildings`, `units`, `payments`, `expenses`, `tenancies`, `maintenance_requests`, `daily_*`):
- SELECT policies: unchanged (gated by `has_data_access`).
- INSERT / UPDATE / DELETE policies: add `AND public.subscription_phase(auth.uid()) IN ('active','canceled')` so writes fail cleanly during grace.

Service role bypass preserved (webhooks, scheduled cleanup, exports).

## 3. Webhook & scheduled job

`payments-webhook` edge function:
- On `subscription.canceled` from Paddle → set `status='canceled'`, `canceled_at=now()`. Access continues until `current_period_end`.
- On `subscription.updated` where renewal resumed → clear `canceled_at`, `data_delete_at`, set `status='active'`, insert reactivation event.

New scheduled edge function `subscription-lifecycle` (pg_cron every hour):
- Promote `canceled` → `grace` when `current_period_end < now()`; set `data_delete_at = current_period_end + 30 days`.
- 7-day and 1-day reminder emails (idempotent via `email_send_log` template_name).
- Promote `grace` → `deleted` when `data_delete_at < now()`: call existing `delete-account` logic scoped to user's data (keep auth user + profile shell so they can log back in and re-subscribe), set `status='deleted'`.

## 4. Frontend

`useSubscription` hook additions:
- `phase: 'active' | 'canceled' | 'grace' | 'deleted' | 'free'`
- `dataDeleteAt: Date | null`
- `graceDaysLeft: number | null`
- `isReadOnly: boolean` (true iff `phase === 'grace'`)
- `canExport: boolean` (true for `active | canceled | grace`)

New components:
- `<GraceBanner />` — sticky yellow banner shown app-wide when `isReadOnly`, with live countdown ("بياناتك محفوظة لمدة X يوم") and two CTAs: **تصدير بياناتي** / **إعادة التفعيل**. Sage-tinted warning (terracotta accent), dismissible per-session but reappears next load.
- `<ExportMyDataDialog />` — wraps existing `Backup.tsx` export logic + a new PDF/Excel bundle. Always reachable from banner and Settings.
- Read-only guards: wrap all add/edit FABs and dialog triggers in a `<WriteGate>` that disables + tooltips "وضع القراءة فقط — أعد تفعيل الاشتراك للتعديل" when `isReadOnly`. Targets: `QuickAddPaymentFab`, Add/Edit dialogs across Buildings/Units/Payments/Expenses/Maintenance/Daily.

Settings → Subscription section:
- During `active`: "إلغاء الاشتراك" button → Paddle customer portal (already wired).
- During `canceled`: shows "ينتهي في DD/MM/YYYY — استأنف" + reactivate button.
- During `grace`: countdown card + export + reactivate.
- During `deleted`: re-subscribe CTA only.

Reactivate flow: opens Paddle customer portal "resume" URL when subscription still exists in Paddle; otherwise redirects to Pricing to start a new subscription. On webhook confirmation the UI auto-updates via realtime.

## 5. Emails

New templates in `_shared/transactional-email-templates/`:
- `grace-started.tsx` — sent when entering grace.
- `grace-7-days.tsx` — 7 days before deletion.
- `grace-1-day.tsx` — 1 day before deletion (final warning).
- `data-deleted.tsx` — confirmation after deletion.

All trilingual-aware (AR primary), include direct export + reactivate links, and respect existing suppression list.

## 6. Export guarantee (PDPL/GDPR)

`Backup.tsx` export path uses SELECT-only queries (RLS allows). Add server-side `export-user-data` edge function as a fallback that runs with service role and streams a ZIP (JSON + CSV per table + PDF summary) so export works even if any client-side issue arises during grace. Reachable from banner + Settings + a stable URL `/export`.

## Out of scope
- Changing trial logic.
- Changing add-on unit handling beyond following the parent subscription phase.
- Annual plans — same lifecycle applies automatically since it's keyed off `current_period_end`.

## Technical notes
- All timestamp math in UTC server-side; client formats with user locale.
- Cron job is idempotent — safe to run hourly.
- `delete-account` edge function already cascades correctly; the lifecycle job reuses its helpers but keeps `auth.users` + `profiles` so re-subscribing works.
- Realtime on `subscriptions` table already subscribed in `useSubscription` — banner + gates react instantly to phase changes.
