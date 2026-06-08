// Native Google sign-in for iOS/Android (Capacitor).
// Web continues to use Lovable Cloud OAuth — this file is only used inside the native app.
//
// Uses @capgo/capacitor-social-login (actively maintained, Capacitor 8 compatible).
// Replaces the archived @codetrix-studio/capacitor-google-auth plugin.
//
// To activate on iOS / Android you must fill in:
//   - GOOGLE_IOS_CLIENT_ID  (Google Cloud Console → OAuth Client → iOS)
//   - GOOGLE_WEB_CLIENT_ID  (Google Cloud Console → OAuth Client → Web)
// Both are public values; safe to keep in source.

import { Capacitor } from "@capacitor/core";
import { SocialLogin } from "@capgo/capacitor-social-login";
import { supabase } from "@/integrations/supabase/client";

// ====== EDIT THESE TWO VALUES AFTER CREATING OAuth CLIENT IDs ======
export const GOOGLE_IOS_CLIENT_ID = "REPLACE_WITH_IOS_CLIENT_ID.apps.googleusercontent.com";
export const GOOGLE_WEB_CLIENT_ID = "REPLACE_WITH_WEB_CLIENT_ID.apps.googleusercontent.com";
// ===================================================================

let initialized = false;

async function ensureInit() {
  if (initialized) return;
  await SocialLogin.initialize({
    google: {
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iOSClientId: GOOGLE_IOS_CLIENT_ID,
      iOSServerClientId: GOOGLE_WEB_CLIENT_ID,
    },
  });
  initialized = true;
}

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

/**
 * Performs native Google sign-in and creates a Supabase session.
 * Throws on failure with a human-readable message.
 */
export async function nativeGoogleSignIn(): Promise<void> {
  await ensureInit();

  const res: any = await SocialLogin.login({
    provider: "google",
    options: {},
  });

  const result = res?.result ?? res;
  const idToken: string | undefined = result?.idToken ?? result?.authentication?.idToken;

  if (!idToken) {
    throw new Error("Google sign-in did not return an idToken");
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  });
  if (error) throw error;
}
