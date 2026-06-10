Make Google sign-in web-only and Apple sign-in app-only in the Auth page.

Changes:

1. **Auth.tsx** — Add `const native = isNative();` near the top of the component.
   - Wrap the Apple button in `{native && (...)}` so it only renders on iOS/Android.
   - Wrap the Google button in `{!native && (...)}` so it only renders on the web.
   - Update the back-link text (`← Apple / Google`) to show only the provider that is available on the current platform.

2. **Auth.tsx** — In `handleOAuth`, add a guard so that if the app is running natively and the provider is `google`, show a toast error and return early. This is a safety net even though the button is hidden.

No changes are needed to `nativeGoogleAuth.ts` or the Edge Function — the native Google path simply becomes unreachable in normal UI flow.

After implementation, commit to `main`.