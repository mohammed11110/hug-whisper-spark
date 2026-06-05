# Premium Motion System for Amlaki

A cohesive, Linear/Vercel-grade motion layer. Tokens + utilities first, then surgical wiring where it matters. CSS/Tailwind for 95% of motion; Framer Motion only for swipe gestures. Respects RTL, `prefers-reduced-motion`, and animates only `transform`/`opacity`.

## 1. Tokens & global CSS (`src/index.css` + `tailwind.config.ts`)

Add CSS variables:
- `--ease-out: cubic-bezier(0, 0, 0.2, 1)`
- `--ease-smooth: cubic-bezier(0.32, 0.72, 0, 1)`
- `--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)`
- `--dur-fast: 150ms`, `--dur-base: 200ms`, `--dur-slow: 300ms`

Add keyframes: `fade-up`, `scale-in` (0.96→1), `slide-up`, `shimmer`, `badge-pop` (1→1.1→1), `tab-fade`.

Tailwind extensions:
- `transitionTimingFunction`: `out`, `smooth`, `spring`
- `transitionDuration`: `fast`, `base`, `slow`
- `keyframes`/`animation`: `fade-up`, `scale-in`, `slide-up`, `shimmer`, `badge-pop`
- Utility classes: `.anim-fade-up`, `.anim-scale-in`, `.anim-stagger > *:nth-child(n)` with `animation-delay: calc(var(--i,0) * 40ms)` capped at 8, `.press-scale` (active:scale-[0.97]), `.card-lift` (hover translateY(-2px) + shadow), `.skeleton-shimmer` (sage-tinted gradient + shimmer keyframe), `.will-anim` (will-change: transform).

Reduced motion:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

RTL-aware page enter: a single `.page-enter` utility using `translateY` only (no horizontal slide on route change to avoid RTL/LTR mirroring complexity; directional slide reserved for tabs).

## 2. Replace legacy classes

Map existing `animate-float-up` → `anim-fade-up` (keep alias for back-compat), keep `animate-slide-up` for sheets, retire `animate-pulse-soft` in favor of `badge-pop` for status changes.

## 3. Component wiring

| Target | Change |
|---|---|
| `AppShell` `<main>` | Add `key={location.pathname}` + `.page-enter` for fade-up on route change (200ms). |
| Page roots (`Dashboard`, `Buildings`, `Payments`, `Tenants`, `UnitDetail`, etc.) | Apply `.anim-fade-up` on top section (replace ad-hoc `animate-float-up`). |
| List containers (buildings/units/tenants/payments rows) | Add `.anim-stagger` on parent; set `style={{'--i': index}}` on each row (cap 8). |
| `ui/card.tsx` | Add `.card-lift` + `.press-scale` opt-in via new `interactive` prop (default off to avoid global regressions). Apply on dashboard cards & list cards. |
| `ui/button.tsx` | Add `active:scale-[0.97] transition-transform duration-150 ease-out` to base; primary variant gets `hover:shadow-soft`. |
| `ui/dialog.tsx` | Update Radix content classes: `data-[state=open]:animate-scale-in` (200ms ease-out), backdrop fade 150ms. |
| `ui/sheet.tsx` / Vaul drawer | Keep native; only ensure no override fights it. |
| Sonner toaster | Untouched. |
| `ui/tabs.tsx` (UnitDetail tabs) | Content: `data-[state=active]:animate-[tab-fade_150ms_ease-out]`. Add sliding underline via `translateX` on a pseudo-indicator (TabsList enhancement). |
| Dashboard numeric KPIs (collected, expected) | Tiny `useCountUp(value, 600ms)` hook; render formatted output. Skips animation if reduced motion. |
| `Skeleton` (`ui/skeleton.tsx`) | Swap pulse for sage `.skeleton-shimmer`. |
| Status badges (`ArrearsBadge`, payment status pill) | When status prop changes, trigger `badge-pop` via a `key={status}` remount or `useEffect` adding/removing class. |

## 4. Gestures (Framer Motion)

Only add to payments list rows in `Payments.tsx`:
- Wrap each row in `motion.div` with `drag="x"`, `dragConstraints={{left:-96,right:0}}` (RTL-mirrored), `dragElastic={0.15}`, spring on release. Reveal a delete/edit action behind. No other Framer usage introduced.

Vaul drawers already handle drag-to-dismiss — leave as is.

## 5. Performance discipline

- `will-change: transform` only on actively dragging rows + open dialogs.
- All animations transform/opacity only — audit removes any width/height transitions in existing components touched.
- No animation blocks pointer events.

## 6. Out of scope

- No business logic changes.
- No new dependencies (Framer Motion already a transitive dep via existing UI; if missing, add `framer-motion` — single add).
- No changes to PDF preview / receipt flow, auth, or backend.

## Files touched

- `src/index.css` (tokens, keyframes, utilities)
- `tailwind.config.ts` (easings, durations, keyframes/animation)
- `src/components/ui/{button,card,dialog,tabs,skeleton}.tsx`
- `src/components/AppShell.tsx` (route key + page-enter)
- `src/components/ArrearsBadge.tsx` + payment status badge
- `src/pages/Dashboard.tsx` (count-up on KPIs, stagger on stats)
- `src/pages/{Buildings,Payments,Tenants}.tsx` + `UnitDetail.tsx` (stagger + page-enter)
- `src/pages/Payments.tsx` (Framer swipe row)
- New: `src/hooks/useCountUp.ts`

## Validation

- Verify in preview at mobile (375) and desktop widths, both LTR and RTL.
- Toggle OS reduced-motion → animations collapse to instant.
- Confirm no layout-affecting properties are animated (DevTools Performance → no Layout in animation frames).
