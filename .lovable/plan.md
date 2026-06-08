# Add Apple & Google Sign-In to Amlaki

## Goal
One-tap sign-in with Apple, Google, or email — satisfying Apple App Store rules and lifting conversion. Web uses Supabase OAuth redirects; native iOS uses the Capacitor social-login plugin with `signInWithIdToken` so the flow stays inside the app.

## Scope

### 1. Auth screen redesign — `src/pages/Auth.tsx`
Match the attached layout exactly:
- Midnight background, gold key logo, "Amlaki / أملاكي" + tagline. No botanical graphics.
- Buttons in this order, full-width, 52px tall, rounded-2xl:
  1. **Continue with Apple** — white bg, black Apple SVG logo, Apple-approved wording. RTL: "المتابعة بحساب Apple".
  2. **Continue with Google** — white bg, official 4-color G logo. RTL: "المتابعة بحساب Google".
  3. Divider with "or / أو".
  4. **Continue with email / المتابعة بالبريد** — outline gold button that expands to the existing email/password form (or routes to a sub-view).
- Small reassurance line below buttons (i18n): "كلمات المرور لا تُحفظ في أملاكي. Apple يتيح إخفاء بريدك."
- Terms / Privacy links at bottom (already present — keep).
- Existing sign-in/sign-up tabs collapse into the email path only.

### 2. Replace Lovable Cloud OAuth with direct Supabase Auth
- `lovable.auth.signInWithOAuth(...)` → `supabase.auth.signInWithOAuth({ provider: "google" | "apple", options: { redirectTo: window.location.origin } })`.
- New handler `handleAppleSignIn()` parallel to Google.

### 3. Native iOS / Android — `src/lib/nativeGoogleAuth.ts`
- Rename file to `src/lib/nativeSocialAuth.ts` (keep old re-export for safety) and add:
  - `nativeAppleSignIn()` using `@capgo/capacitor-social-login`'s `SocialLogin.login({ provider: "apple", options: { scopes: ["email", "name"] } })`, then `supabase.auth.signInWithIdToken({ provider: "apple", token: idToken, nonce })`.
  - Extend `SocialLogin.initialize({ apple: { clientId: "<Services ID>", redirectUrl: "https://amlaki1.app/auth/callback" } })`.
- `isNativeApp()` branch in `Auth.tsx` routes to `nativeAppleSignIn()` / `nativeGoogleSignIn()`.

### 4. Profile auto-creation & relay email
- Existing `handle_new_user()` trigger already creates a profile from `auth.users` on first sign-in — works for OAuth too. No SQL changes needed.
- Confirm `profiles.email` column tolerates Apple relay addresses (`@privaterelay.appleid.com`) — it's just a string, no validation regex to relax.
- After session, route to `/` (Dashboard auto-detects first-time users via existing onboarding tour).

### 5. Account linking
- Enable Supabase **Auth → "Link identities to existing user by email"** so a user who signs in with Apple then Google (same email) is merged.
- When Apple returns a relay email, linking by email won't match a prior Google account — show a toast: "هذا الحساب جديد. لربط حسابك السابق، سجّل دخول بالطريقة الأصلية ثم اربط من الإعدادات." (Linking UI in Settings is **out of scope** for this round — flagged for follow-up.)

### 6. i18n — `src/lib/i18n.tsx`
Add keys (AR + EN): `continue_with_apple`, `continue_with_google`, `continue_with_email`, `or_divider`, `passwords_not_stored_note`, `apple_hide_email_note`.

### 7. Capacitor config — `capacitor.config.ts`
Add `SocialLogin` plugin block (Apple service ID placeholder, Google client IDs already present).

## User setup steps (you do these, outside the app)

**Google (web + iOS):**
1. Google Cloud Console → APIs & Services → Credentials.
2. Create **OAuth Client ID → Web application**. Authorized redirect URI: `https://pbfgqbtppeztnlotqnrz.supabase.co/auth/v1/callback`. Authorized JS origins: `https://amlaki1.app`, `https://www.amlaki1.app`, `https://amlaki1-app.lovable.app`.
3. Create **OAuth Client ID → iOS** with bundle ID `app.lovable.c6fcf97d71d44c46b75687a26fc2bf21`.
4. Paste Web Client ID + Secret into Supabase → Authentication → Providers → Google.
5. Paste Web Client ID + iOS Client ID into `src/lib/nativeSocialAuth.ts` and `capacitor.config.ts`.

**Apple (requires paid Apple Developer account — $99/yr):**
1. developer.apple.com → Identifiers → **App ID** for `app.lovable.c6fcf97d71d44c46b75687a26fc2bf21` → enable "Sign In with Apple".
2. Create **Services ID** (e.g. `app.lovable.amlaki.web`) → enable Sign In with Apple → configure web domain `amlaki1.app` + return URL `https://pbfgqbtppeztnlotqnrz.supabase.co/auth/v1/callback`.
3. Create a **Sign in with Apple Key (.p8)** → download once, note Key ID.
4. Note your Team ID.
5. Generate a JWT client secret (ES256, 6-month max) from Team ID + Key ID + Services ID + `.p8`. I'll provide a one-shot Node script.
6. Paste Services ID (as Client ID) + JWT (as Secret) into Supabase → Authentication → Providers → Apple.
7. In Xcode: target → Signing & Capabilities → **+ Sign In with Apple**.

## Files touched
- `src/pages/Auth.tsx` (redesign + Apple button + Supabase OAuth)
- `src/lib/nativeGoogleAuth.ts` → rename to `nativeSocialAuth.ts`, add Apple
- `src/lib/i18n.tsx` (new keys)
- `capacitor.config.ts` (SocialLogin plugin)

## Out of scope (flagged)
- Settings → linked accounts UI (manual account linking for relay-email mismatch).
- Android-native Apple sign-in (Apple on Android works via web redirect only — acceptable).

## Open questions
1. Do you have an active **Apple Developer Program** membership? If not, I'll ship Google now and add Apple after enrollment (App Store submission will block until Apple is live).
2. For the email button — open inline (current tabbed form) or route to `/auth/email`?
