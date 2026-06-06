// Native Google sign-in for iOS/Android (Capacitor).
// Web continues to use Lovable Cloud OAuth — this file is only used inside the native app.
//
// Uses @codetrix-studio/capacitor-google-auth (Google-only, does NOT pull
// Facebook SDK on iOS — avoids the long "Fetching facebook-ios-sdk" hang
// observed with multi-provider social login plugins).
//
// To activate on iOS / Android you must fill in:
//   - GOOGLE_IOS_CLIENT_ID  (Google Cloud Console → OAuth Client → iOS)
//   - GOOGLE_WEB_CLIENT_ID  (Google Cloud Console → OAuth Client → Web)
// Both are public values; safe to keep in source.

import { Capacitor } from "@capacitor/core";
import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth";
import { supabase } from "@/integrations/supabase/client";

// ====== EDIT THESE TWO VALUES AFTER CREATING OAuth CLIENT IDs ======
export const GOOGLE_IOS_CLIENT_ID = "REPLACE_WITH_IOS_CLIENT_ID.apps.googleusercontent.com";
export const GOOGLE_WEB_CLIENT_ID = "REPLACE_WITH_WEB_CLIENT_ID.apps.googleusercontent.com";
// ===================================================================

let initialized = false;

async function ensureInit() {
  if (initialized) return;
  await GoogleAuth.initialize({
    clientId: GOOGLE_WEB_CLIENT_ID,
    scopes: ["email", "profile"],
    grantOfflineAccess: false,
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

  const res: any = await GoogleAuth.signIn();

  const idToken: string | undefined =
    res?.authentication?.idToken ?? res?.idToken;

  if (!idToken) {
    throw new Error("Google sign-in did not return an idToken");
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  });
  if (error) throw error;
}
