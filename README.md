# أملاكي · Amlaki

Premium property management for landlords across MENA and beyond.
Manage buildings, units, tenants, rent, expenses, maintenance and
daily rentals — bilingual (Arabic / English), RTL-first, mobile-grade.

🌐 Live: [amlaki1.app](https://amlaki1.app)

---

## Tech stack

- **Frontend**: React 18 · Vite 5 · TypeScript · Tailwind CSS v3 · shadcn/ui
- **State**: TanStack Query · React Context
- **Backend**: Lovable Cloud (Postgres + Edge Functions + Auth + Storage)
- **Mobile**: Capacitor 8 (iOS + Android) · Push via FCM
- **Payments**: Paddle Billing (sandbox + live)
- **AI**: Lovable AI Gateway (Gemini 2.5, GPT-5)
- **Monitoring**: Sentry (optional)
- **PWA**: Installable web manifest, sage-tinted brand chrome

## Project structure

```
src/
├── pages/          Route-level pages (lazy-loaded)
├── components/     Reusable UI + shadcn primitives in ui/
├── hooks/          useSubscription, usePaddleCheckout, …
├── lib/            i18n, auth, balance, notify, sentry, push, queryClient
├── integrations/   Auto-generated Supabase client + types
└── assets/         Bundled images / SVG
supabase/
├── migrations/     SQL migrations (RLS, schemas, triggers)
└── functions/      Deno edge functions (webhooks, lifecycle, AI)
```

## Setup

```bash
bun install            # or: npm install
bun dev                # http://localhost:8080
```

Lovable Cloud is auto-connected — no Supabase project to wire up.

### Environment

Copy `.env.example` → `.env` and fill in values. Required vars for local
dev are auto-injected by Lovable Cloud. Optional vars:

| Var | Purpose |
|-----|---------|
| `VITE_SENTRY_DSN` | Error monitoring (no-op if unset) |

## Mobile build (Capacitor)

```bash
# One-time, on your local machine after `git pull`:
npm install
npx cap add ios          # macOS + Xcode required
npx cap add android      # Android Studio required

# Every time you pull new web code:
npm run build
npx cap sync

# Run on device / simulator:
npx cap run ios
npx cap run android
```

Hot-reload from the Lovable sandbox during development:

```bash
CAP_ENV=dev npx cap run ios
```

## Plans & pricing

| Plan | Units | Best for |
|------|-------|----------|
| Free | 3 | Trying it out |
| Personal | 10 | A single landlord |
| Pro | 25 | Multiple buildings |
| Business | 75 + add-ons | Property managers |
| Enterprise | Custom | Large portfolios |

All paid plans include a **14-day free trial** with unlimited units,
followed by a **30-day read-only grace** for data export before
permanent deletion (PDPL / GDPR compliant).

## Brand

Sage palette, Outfit (Latin) + Noto Kufi Arabic (RTL) fonts, sage-tinted
shadows, botanical decoration. See `mem://brand/identity` for the
full spec.

## License

Proprietary — © Amlaki. All rights reserved.
