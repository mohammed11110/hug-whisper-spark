# 14-Day Trial + Data Retention Policy

Builds on the existing grace-period infrastructure (subscriptions.canceled_at, grace_started_at, data_delete_at, subscription_phase, can_write, RESTRICTIVE write-gating RLS, GraceBanner, subscription-lifecycle cron). This plan adds the **trial phase** and the **3-channel staged notification system**.

## Lifecycle

```text
SIGNUP ──► TRIAL (14 days, unlimited units)
            │ trial_ends_at reached, no paid sub
            ▼
         READONLY_GRACE (30 days, view + export + reactivate)
            │ grace_ends_at reached
            ▼
         DELETED (permanent)
```

Subscribing at any point during TRIAL or GRACE → instant ACTIVE.

## 1. Database

Migration on `public.profiles`:
- `trial_started_at timestamptz default now()` — set on signup via existing `handle_new_user` trigger.
- `trial_ends_at timestamptz` — `trial_started_at + 14 days`.
- `grace_ends_at timestamptz` — set to `trial_ends_at + 30 days` when trial expires without sub.
- `account_status` extends to include `'trial' | 'readonly_grace'` (plus existing `'active' | 'deleted'`).

Helper functions:
- `public.account_phase(uid)` — single source of truth: returns `'trial' | 'active' | 'readonly_grace' | 'subscription_grace' | 'deleted' | 'free'`. Combines paid-sub phase (existing `subscription_phase`) with trial phase from profile. Paid sub always wins over trial.
- Update `can_write(uid)` to allow writes during `trial | active | canceled`, block during `readonly_grace | subscription_grace | deleted`.
- Update `has_data_access(uid)` to allow read during everything except `deleted`.
- During trial: unit-quota trigger (`enforce_unit_quota`) is bypassed — trial users get unlimited units.

New table `public.notification_log`:
- `user_id`, `kind` (`trial-d10|trial-d13|trial-end|grace-d7|grace-d37|grace-d43|grace-d1`), `channel` (`email|in_app|push`), `sent_at`, unique on (user_id, kind, channel) for idempotency.

New table `public.in_app_notifications`:
- `user_id`, `title_ar`, `title_en`, `body_ar`, `body_en`, `kind`, `action_url`, `read_at`, `created_at`.
- RLS: users SELECT/UPDATE (mark read) own rows; service_role inserts.

New table `public.push_subscriptions`:
- `user_id`, `token` (Capacitor FCM/APNs token), `platform` (`ios|android|web`), `created_at`, unique on token.

## 2. Trial provisioning

Update `handle_new_user()` trigger: on insert, set `trial_started_at = now()`, `trial_ends_at = now() + 14 days`, `account_status = 'trial'`.

Backfill migration for existing users without a paid sub: set `trial_ends_at = COALESCE(trial_ends_at, created_at + 14 days)`.

## 3. Scheduled job (extend existing `subscription-lifecycle`)

Single cron, every hour, now also handles trial:

| Day | Action | Channels |
|-----|--------|----------|
| -4 (D10)  | "Trial ends in 4 days" | email + in_app + push |
| -1 (D13)  | "Trial ends tomorrow" | email + in_app + push |
|  0 (D14)  | Promote → `readonly_grace`, set `grace_ends_at = now() + 30d` | email + in_app + push |
| +7 (D21)  | "23 days before deletion" | email + in_app + push |
| +23 (D37) | "Data deleted in 7 days" | email + in_app + push |
| +29 (D43) | "Deletion tomorrow — export now" | email + in_app + push |
| +30 (D44) | Permanently delete data, set status=`deleted` | email |

Idempotency via `notification_log` unique constraint. Same dispatcher reuses the `enqueue_email` RPC and adds `in_app_notifications` insert + push fan-out.

## 4. Push notifications (Capacitor)

- New edge function `send-push` — takes `user_id`, looks up tokens, fans out to FCM (Android/web) + APNs (iOS) via a single provider. Recommend **FCM HTTP v1** (free, handles both with one creds set) — needs one secret: `FCM_SERVICE_ACCOUNT_JSON`.
- Client registration in `src/lib/push.ts`: on app boot inside Capacitor, request permission via `@capacitor/push-notifications`, upsert token into `push_subscriptions`.
- Settings → Notifications: toggle to enable/disable + permission state.

## 5. Frontend

`useSubscription` → add `phase: 'trial' | ...`, `trialEndsAt`, `trialDaysLeft`, `graceEndsAt`. Replace ad-hoc `phase` derivation with one call to `account_phase` RPC for parity with server.

Banner system (`<LifecycleBanner />` replaces `<GraceBanner />`):
- TRIAL with >4 days: subtle sage tint, "تجربتك المجانية: X يوماً متبقياً".
- TRIAL with ≤4 days: gold tint, prominent "Subscribe" CTA + live countdown.
- READONLY_GRACE: terracotta tint, countdown "بياناتك محفوظة X يوماً — اشترك الآن"; Export + Subscribe CTAs.
- All CTAs: **Subscribe button always larger & gold-accented** than secondary actions. "Delete" wording avoided; we say "حذف البيانات بعد X يوماً" only in the final 7 days.

In-app notification center:
- New `<NotificationBell />` in `TopBar`: unread count, dropdown list, mark-as-read on open.
- Realtime subscription to `in_app_notifications` so bell updates instantly.
- Tap notification → navigates to `action_url` (Pricing / Backup).

Pricing page upgrade-suggestion:
- When `unitCount > PLAN_UNIT_LIMITS.business`, show "Business + N addon units" pre-selected with computed monthly price (`PLAN_UNIT_LIMITS.business` base + `(unitCount - 75) * ADDON_UNIT_PRICE.business`).
- Banner CTA when in grace deeplinks here with `?units=N`.

Export button: already exists in Backup; surface a one-click "Export My Data (ZIP: Excel + PDF)" button in banner + Settings during grace via new `export-user-data` edge function (planned earlier).

## 6. Emails

6 new templates under `_shared/transactional-email-templates/`:
`trial-d10.tsx`, `trial-d13.tsx`, `trial-ended.tsx`, `grace-d7.tsx` (was grace-started, repurpose), `grace-d37.tsx`, `grace-d43.tsx`, `data-deleted.tsx`. Reuse existing brand template shell; AR primary, EN fallback per profile locale.

## 7. Read-only enforcement

Already done by existing RESTRICTIVE policies via `can_write()`. After updating `can_write()` to include `trial`, no further RLS changes needed for trial users to write.

UX gating: `<WriteGate>` wrapper disables Add/Edit FABs + dialog triggers when `isReadOnly`, with tooltip "وضع القراءة فقط — اشترك لاستئناف التعديل". Applied to: `QuickAddPaymentFab`, Add/Edit dialogs in Buildings/Units/Payments/Expenses/Maintenance/Daily.

## 8. Reactivation

- Banner "اشترك الآن" → `/pricing` with addon-units preselected if quota exceeds plans.
- Settings → Subscription section: phase-aware copy + primary Subscribe button.
- On successful Paddle webhook → existing `reactivate_subscription` logic clears grace fields; realtime updates UI.

## Out of scope
- Changing existing paid-sub cancellation flow (already implemented).
- Changing trial length per plan (single 14-day for all).
- SMS channel (only email + in_app + push as requested).

## Technical notes
- All timestamps in UTC server-side; client formats per locale.
- Trial backfill is one-time, idempotent.
- Push requires `FCM_SERVICE_ACCOUNT_JSON` secret — will prompt user before scaffolding `send-push`.
- iOS APNs via FCM works without separate Apple creds for dev; production may need APNs key — surface this only when user publishes to App Store.
