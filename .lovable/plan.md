# Production-grade upgrades — 3 priorities

## P1 — Performance

**Lazy route loading (`src/App.tsx`)**
- Convert every page import (Dashboard, Buildings, BuildingDetail, UnitDetail, Payments, PaymentsTrash, Settings, Reports, Tenants, BuildingExpenses, Notifications, Backup, Team, Install, Pricing, Terms, Privacy, Refund, Assistant, Admin, Maintenance, Activity, Unsubscribe, NotFound, Welcome, Auth, ForgotPassword, ResetPassword, and all `daily/*`) to `lazy(() => import(...))`.
- Keep `AppShell`, `RequireAuth`, providers eagerly imported (they're shell, not route bodies).
- Wrap `<Routes>` in `<Suspense fallback={<LoadingScreen />}>`.

**LoadingScreen (`src/components/LoadingScreen.tsx` — new)**
- Full-viewport, cream background (`bg-[hsl(var(--background))]` → cream `#faf6ee`), centered Amlaki key-logo SVG (reuse existing brand mark), subtle sage spinner ring (`border-[hsl(var(--primary))]` animate-spin), no text spam.
- Honors `prefers-reduced-motion`.

**Image compression (`src/lib/imageCompression.ts` — new)**
- Install `browser-image-compression`.
- Helper `compressImage(file, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true, preserveExif: false })`; return original if not an image or already < 200KB.
- Integrate at every upload site: `FileUpload.tsx`, `AddMaintenanceDialog.tsx`, `NewTenancyDialog.tsx`, contract / unit-photo / tenant-id / branding flows in `UnitDetail.tsx`. Show inline "…يجري التحسين / Optimizing…" state on the trigger while awaiting compression, then proceed to Supabase upload.

## P2 — Error handling

**Global ErrorBoundary (`src/components/ErrorBoundary.tsx` — new)**
- Class component wrapping `<App />` content (mount inside providers, outside `<BrowserRouter>` is fine, but inside `I18nProvider` so we can translate).
- Fallback UI: cream bg, Amlaki logo, bilingual heading "حدث خطأ ما — Something went wrong", short reassurance line, primary sage "إعادة المحاولة / Try Again" button that calls `this.setState({ error: null })` and force-resets a `key` on children, plus a secondary "العودة للرئيسية / Home" link.
- Forwards error to Sentry via `Sentry.captureException`.

**Sentry (`src/lib/sentry.ts` — new)**
- Add `@sentry/react`. Init in `main.tsx` only when `import.meta.env.VITE_SENTRY_DSN` is set: `Sentry.init({ dsn, tracesSampleRate: 0.1, replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 1.0, integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()], environment: import.meta.env.MODE })`.
- Wrap ErrorBoundary with `Sentry.ErrorBoundary` or call `captureException` from `componentDidCatch`.
- Set user context from `AuthProvider` (`Sentry.setUser({ id })`) on login, clear on logout.
- User adds `VITE_SENTRY_DSN` to env; no-op without it.

**Friendly error messages + toasts**
- Audit `catch` blocks in `src/pages/**` and `src/components/**`. Replace raw `error.message` toasts with mapped human strings (bilingual via `useI18n`). Keep raw error in `console.error` + Sentry only.
- Standardize via `src/lib/notify.ts` (new): `notify.success(msg)` → sonner sage; `notify.error(msg)` → sonner burgundy. Configure sonner `<Toaster />` with `toastOptions` using sage (`hsl(var(--primary))`) success and burgundy (`#a85d5d` mapped to `--destructive`) error styles.

## P3 — Arrears as derived state

**Single source of truth (`src/lib/balance.ts`)**
- Already mostly there. Add/export `calculateBalance(unit, payments, today)` with the exact spec:
  - `n` = count of due-day occurrences from `contract_start_date` (anchored on `due_day` 1–31, clamped to month-end) up to and including `today`.
  - `totalDue = n * rent`.
  - `totalPaid = payments.filter(p => p.unit_id === unit.id && !p.deleted_at && p.kind !== 'opening').reduce((s,p) => s + Number(p.amount), 0)`.
  - `balance`, `arrears`, `credit`, `status` (`paid` if ≤0, `critical` if ≥ 2×rent, else `overdue`) per reference.
- Use this in `UnitDetail`, `Buildings`, `BuildingDetail`, `Payments`, `Tenants`, `Reports`, `Dashboard`, `Assistant`, and `pdfDocs.ts`. Remove any local "if payments.length > 0 → paid" logic.

**Stop persisting status**
- Remove all client-side writes that set `units.status = 'paid' | 'overdue' | …` (search `units.*update.*status`). DB trigger `recompute_unit_state` stays for now but UI must never trust `unit.status`; always compute via `calculateBalance`. (Server triggers will be deprecated in a follow-up.)
- Ensure every payment insert/update writes `period_end` (it already exists in schema; verify `RecordPaymentDialog` / `AddPaymentDialog` populate it; default to the cycle's end when omitted).

**Instant updates**
- After any payment mutation (insert / update / soft-delete / restore), call:
  ```ts
  queryClient.invalidateQueries({ queryKey: ['units'] });
  queryClient.invalidateQueries({ queryKey: ['payments'] });
  ```
  Apply in every payment mutation handler — no reliance on cron or page reload.

## Acceptance verification

- Bundle: `bun run build` and confirm route chunks split (each page in its own chunk, initial chunk shrinks ~60–70%).
- Error boundary: throw from a dev-only test route → friendly fallback renders.
- Arrears 300, pay 100 → UI shows balance 200, status `overdue` immediately.
- Full payment → status flips to `paid` without refresh.
- Advance system date past a due day → arrears auto-increments by one month on next render (pure function, no DB write).

## Out of scope

- Removing the existing `recompute_unit_state` SQL trigger (kept for backward compatibility; UI no longer depends on it).
- Backfilling `period_end` on historical rows.
- Server-side compression / CDN image transforms.
