## Plan

1. Update `src/lib/nativeGoogleAuth.ts` so the iOS Google path is exclusively:
   - get `idToken` from the native plugin
   - call `supabase.functions.invoke('google-native-signin', { body: { idToken, nonce } })`
   - read `access_token` and `refresh_token` from the response
   - call `supabase.auth.setSession(...)`
   - remove any direct `signInWithIdToken` usage from the iOS branch

2. Tighten `supabase/functions/google-native-signin/index.ts` so it:
   - logs at the start of execution
   - manually verifies the Google JWT with Google JWKS
   - accepts both web and iOS client IDs as valid audiences
   - validates issuer, expiry, and hashed nonce
   - creates the app session through the admin/service-role flow instead of `signInWithIdToken`
   - returns `access_token` and `refresh_token` in a stable response shape

3. Verify the implementation paths before finishing:
   - confirm the iOS branch contains no direct `signInWithIdToken`
   - confirm the edge function response matches what `setSession` expects
   - confirm the edge function start log is present for device-side debugging

4. Make one focused code change set so Lovable generates a fresh sync commit to `main`, then report the new commit message back to you.

## Technical details

- Web/native non-iOS Google flow stays unchanged unless required by the iOS fix.
- Apple sign-in is untouched.
- No auth changes will be made in the generated client file.
- The goal is a new code commit on `main` that clearly includes `nativeGoogleAuth.ts` and `google-native-signin/index.ts`.