// Native social sign-in for iOS/Android (Capacitor).
// Web continues to use Lovable Managed OAuth — this file is only used inside the native app.
//
// Uses @capgo/capacitor-social-login (actively maintained, Capacitor 8 compatible).
// Follows the recommended nonce flow from Capgo + Supabase docs to avoid
// "Unacceptable audience in id_token" and "nonce mismatch" errors.

import { Capacitor } from "@capacitor/core";
import { SocialLogin } from "@capgo/capacitor-social-login";
import { supabase } from "@/integrations/supabase/client";

// ====== Public OAuth identifiers (safe to keep in source) ======
export const GOOGLE_IOS_CLIENT_ID =
  "333958704131-p0345q3rti29e70oesqmgvpah2q8e58a.apps.googleusercontent.com";
export const GOOGLE_WEB_CLIENT_ID =
  "333958704131-3f0rajm780ophcb2g770apn5hkbto3hq.apps.googleusercontent.com";

// Valid Google audiences accepted in the id_token (web + iOS).
const VALID_GOOGLE_AUDIENCES = [GOOGLE_WEB_CLIENT_ID, GOOGLE_IOS_CLIENT_ID];
// =================================================================

let initialized = false;

async function ensureInit() {
  if (initialized) return;
  await SocialLogin.initialize({
    google: {
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iOSClientId: GOOGLE_IOS_CLIENT_ID,
      iOSServerClientId: GOOGLE_WEB_CLIENT_ID,
      mode: "online",
    } as any,
    // Apple on native iOS automatically uses the app's Bundle ID — no clientId required.
    apple: {} as any,
  });
  initialized = true;
}

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

// ---------------- nonce helpers ----------------
function getUrlSafeNonce(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function decodeJwtPayload(token: string): any | null {
  try {
    const part = token.split(".")[1];
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

// ---------------- Google ----------------
async function doGoogleSignInOnce(): Promise<void> {
  const rawNonce = getUrlSafeNonce();
  const nonceDigest = await sha256Hex(rawNonce);

  const res: any = await SocialLogin.login({
    provider: "google",
    options: {
      scopes: ["email", "profile"],
      nonce: nonceDigest,
      forcePrompt: true,
    } as any,
  });
  const result = res?.result ?? res;
  const idToken: string | undefined =
    result?.idToken ?? result?.authentication?.idToken;
  if (!idToken) throw new Error("Google sign-in did not return an idToken");

  // Validate audience + nonce locally for clearer errors and to detect
  // iOS cached tokens early.
  const payload = decodeJwtPayload(idToken);
  if (!payload || !VALID_GOOGLE_AUDIENCES.includes(payload.aud)) {
    throw new Error("INVALID_AUDIENCE");
  }
  if (payload.nonce && payload.nonce !== nonceDigest) {
    throw new Error("NONCE_MISMATCH");
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
    nonce: rawNonce,
  });
  if (error) throw error;
}

export async function nativeGoogleSignIn(): Promise<void> {
  await ensureInit();
  try {
    try {
      await SocialLogin.logout({ provider: "google" } as any);
    } catch {}
    await doGoogleSignInOnce();
  } catch (e: any) {
    const msg = String(e?.message || e);
    // iOS Google SDK can return a cached token with a stale nonce — log out and retry once.
    if (msg.includes("NONCE_MISMATCH") || msg.includes("INVALID_AUDIENCE")) {
      try {
        await SocialLogin.logout({ provider: "google" } as any);
      } catch {}
      await doGoogleSignInOnce();
      return;
    }
    throw e;
  }
}

// ---------------- Apple ----------------
export async function nativeAppleSignIn(): Promise<void> {
  await ensureInit();
  const rawNonce = getUrlSafeNonce();
  const nonceDigest = await sha256Hex(rawNonce);

  const res: any = await SocialLogin.login({
    provider: "apple",
    options: { scopes: ["email", "name"], nonce: nonceDigest } as any,
  });
  const result = res?.result ?? res;
  const idToken: string | undefined =
    result?.idToken ?? result?.identityToken ?? result?.authentication?.idToken;
  if (!idToken) throw new Error("Apple sign-in did not return an idToken");

  const { error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: idToken,
    nonce: rawNonce,
  });
  if (error) throw error;
}
