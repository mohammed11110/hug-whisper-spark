# Fix "Something went wrong" on Buildings & Settings pages

## Root cause

`src/hooks/useSubscription.ts` (line ~168) creates a Supabase realtime channel with a fixed name `subs:${user.id}`. In React StrictMode (dev) the effect runs twice, and on the second run `supabase.channel("subs:...")` returns the **same** channel that is already in the `joined` state. Adding `.on("postgres_changes", ...)` to an already-subscribed channel throws:

> cannot add `postgres_changes` callbacks for realtime:subs:... after `subscribe()`.

This uncaught error bubbles up to `ErrorBoundary`, which shows the bilingual "Something went wrong" screen on any page that mounts this hook (Buildings, Settings, sidebar, GraceBanner, etc.).

## Fix

Edit `src/hooks/useSubscription.ts`:

1. Give the channel a unique name per effect run, e.g.
   ```ts
   const channel = supabase.channel(`subs:${user.id}:${crypto.randomUUID()}`)
   ```
   so a fresh channel is created on every mount and the `.on()` calls always happen before `.subscribe()`.
2. Keep the existing cleanup `supabase.removeChannel(channel)` so the previous channel is properly torn down on unmount.

That's the only code change required. No DB, no UI, no schema changes.

## Verification

- Reload `/buildings` and `/settings` — the error screen should be gone.
- Realtime updates to `subscriptions` / `profiles` should still trigger `load()`.
- Check console for the original "cannot add postgres_changes callbacks…" error — should not reappear.
