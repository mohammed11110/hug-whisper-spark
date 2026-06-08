// Native social sign-in for iOS/Android (Capacitor).
// Web continues to use supabase.auth.signInWithOAuth — this file is only used inside the native app.
//
// Uses @capgo/capacitor-social-login (actively maintained, Capacitor 8 compatible).
//
// To activate you must fill in:
//   - GOOGLE_IOS_CLIENT_ID  (Google Cloud Console → OAuth Client → iOS)
//   - GOOGLE_WEB_CLIENT_ID  (Google Cloud Console → OAuth Client → Web)
//   - APPLE_SERVICES_ID     (Apple Developer → Identifiers → Services ID, used as clientId)
// All three are public values; safe to keep in source.

import { Capacitor } from "@capacitor/core";
import { SocialLogin } from "@capgo/capacitor-social-login";
import { supabase } from "@/integrations/supabase/client";

// ====== EDIT THESE VALUES AFTER CREATING OAuth IDs ======
export const GOOGLE_IOS_CLIENT_ID = "REPLACE_WITH_IOS_CLIENT_ID.apps.googleusercontent.com";
export const GOOGLE_WEB_CLIENT_ID = "REPLACE_WITH_WEB_CLIENT_ID.apps.googleusercontent.com";
export const APPLE_SERVICES_ID = "app.lovable.amlaki.web"; // Services ID from Apple Developer
export const APPLE_REDIRECT_URL = "https://amlaki1.app/auth/callback";
// =========================================================

let initialized = false;

async function ensureInit() {
  if (initialized) return;
  await SocialLogin.initialize({
    google: {
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iOSClientId: GOOGLE_IOS_CLIENT_ID,
      iOSServerClientId: GOOGLE_WEB_CLIENT_ID,
    },
    apple: {
      clientId: APPLE_SERVICES_ID,
      redirectUrl: APPLE_REDIRECT_URL,
    },
  });
  initialized = true;
}

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

/**
 * Native Google sign-in → Supabase session via idToken.
 */
export async function nativeGoogleSignIn(): Promise<void> {
  await ensureInit();
  const res: any = await SocialLogin.login({ provider: "google", options: {} });
  const result = res?.result ?? res;
  const idToken: string | undefined = result?.idToken ?? result?.authentication?.idToken;
  if (!idToken) throw new Error("Google sign-in did not return an idToken");
  const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken });
  if (error) throw error;
}

/**
 * Native Apple sign-in (iOS) → Supabase session via idToken.
 * On Android, Apple login falls back to a web redirect handled by Supabase OAuth.
 */
export async function nativeAppleSignIn(): Promise<void> {
  await ensureInit();
  const res: any = await SocialLogin.login({
    provider: "apple",
    options: { scopes: ["email", "name"] },
  });
  const result = res?.result ?? res;
  const idToken: string | undefined =
    result?.idToken ?? result?.identityToken ?? result?.authentication?.idToken;
  if (!idToken) throw new Error("Apple sign-in did not return an idToken");
  const { error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: idToken,
  });
  if (error) throw error;
}
