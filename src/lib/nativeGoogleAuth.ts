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

// Native iOS can legitimately return the iOS audience, so our edge function accepts
// both the web and iOS client IDs after manual Google certificate verification.
const VALID_GOOGLE_AUDIENCES = [GOOGLE_WEB_CLIENT_ID, GOOGLE_IOS_CLIENT_ID];
// =================================================================

let initialized = false;

function getGoogleInitConfig() {
  if (Capacitor.getPlatform() === "ios") {
    return {
      iOSClientId: GOOGLE_IOS_CLIENT_ID,
      iOSServerClientId: GOOGLE_WEB_CLIENT_ID,
      mode: "online",
    } as any;
  }

  return {
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iOSClientId: GOOGLE_IOS_CLIENT_ID,
    iOSServerClientId: GOOGLE_WEB_CLIENT_ID,
    mode: "online",
  } as any;
}

function getAcceptedGoogleAudiences() {
  return VALID_GOOGLE_AUDIENCES;
}

function getJwtAudiences(payload: any): string[] {
  if (Array.isArray(payload?.aud)) {
    return payload.aud.filter((value: unknown): value is string => typeof value === "string");
  }
  return typeof payload?.aud === "string" ? [payload.aud] : [];
}

async function ensureInit(force = false) {
  if (initialized && !force) return;
  await SocialLogin.initialize({
    google: getGoogleInitConfig(),
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
// ALL native Google sign-in (iOS + Android) is routed through the
// `google-native-signin` Edge Function. The function manually verifies the
// Google id_token against Google's JWKS and accepts both the web client ID
// and the iOS client ID as valid audiences — something `signInWithIdToken`
// cannot do because the Supabase Auth Google provider has only one
// configured client ID slot. Direct `signInWithIdToken` calls in the
// native path are forbidden here.
async function doGoogleSignInOnce(): Promise<void> {
  const rawNonce = getUrlSafeNonce();
  const nonceDigest = await sha256Hex(rawNonce);
  const platform = Capacitor.getPlatform();

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

  // Local pre-flight: surface a clear error before round-tripping to the
  // edge function when the token audience is obviously wrong.
  const payload = decodeJwtPayload(idToken);
  const audiences = getJwtAudiences(payload);
  const acceptedAudiences = getAcceptedGoogleAudiences();
  if (!payload || !audiences.some((aud) => acceptedAudiences.includes(aud))) {
    throw new Error(`INVALID_AUDIENCE:${audiences.join(",") || "missing"}`);
  }
  if (payload.nonce && payload.nonce !== nonceDigest) {
    throw new Error("NONCE_MISMATCH");
  }

  console.log(
    `[nativeGoogleSignIn] ${platform} token received; invoking google-native-signin edge function`
  );
  const { data, error } = await supabase.functions.invoke("google-native-signin", {
    body: {
      idToken,
      nonce: rawNonce,
    },
  });

  if (error) {
    console.error("[nativeGoogleSignIn] edge function error", error);
    throw error;
  }

  const accessToken = data?.access_token ?? data?.session?.access_token;
  const refreshToken = data?.refresh_token ?? data?.session?.refresh_token;

  if (!accessToken || !refreshToken) {
    console.error("[nativeGoogleSignIn] missing tokens in edge response", data);
    throw new Error("google-native-signin did not return a valid session");
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (sessionError) throw sessionError;
}

export async function nativeGoogleSignIn(): Promise<void> {
  console.log("[nativeGoogleSignIn] Starting Google authentication flow...");
  await ensureInit(Capacitor.getPlatform() === "ios");
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
      await ensureInit(true);
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
