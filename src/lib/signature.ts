/**
 * User signature: stored as a transparent PNG in Supabase Storage under
 * `signatures/{user_id}.png`. Cached as a data URL in **localStorage** so the
 * signature survives across app restarts (next-day open, iOS WKWebView
 * recycles, offline launches, etc.).
 *
 * One file per user — saving overwrites; deleting removes both the file and
 * the `signature_path` pointer on `profiles`.
 */
import { supabase } from "@/integrations/supabase/client";

// v2 cache: localStorage (persistent) — was sessionStorage (lost on next-day
// launches and after iOS killed the app).
const CACHE_KEY = "amlaki_signature_dataurl_v2";
const CACHE_USER_KEY = "amlaki_signature_uid_v2";
const CACHE_UPDATED_KEY = "amlaki_signature_updated_at_v2";
// Legacy v1 sessionStorage keys — cleaned up on read.
const LEGACY_CACHE_KEY = "amlaki_signature_dataurl_v1";
const LEGACY_USER_KEY = "amlaki_signature_uid_v1";

/** Tiny event bus so every mounted UI refreshes when the signature changes
 *  on this device OR on any other signed-in device (via Realtime). */
type SigListener = () => void;
const sigListeners = new Set<SigListener>();
export const signatureBus = {
  on(fn: SigListener) { sigListeners.add(fn); return () => sigListeners.delete(fn); },
  emit() { sigListeners.forEach((f) => { try { f(); } catch { /* noop */ } }); },
};

/** Tracks the last time *this device* primed the cache after a local save.
 *  Used to suppress echo refreshes that this device just triggered. */
let lastLocalPrimeAt = 0;
let lastLocalUpdatedAt: string | null = null;
const LOCAL_PRIME_WINDOW_MS = 8000;
function isRecentLocalPrime(remoteUpdatedAt?: string | null): boolean {
  if (Date.now() - lastLocalPrimeAt > LOCAL_PRIME_WINDOW_MS) return false;
  if (!remoteUpdatedAt || !lastLocalUpdatedAt) return true;
  return remoteUpdatedAt === lastLocalUpdatedAt;
}



function pathFor(uid: string) {
  return `${uid}.png`;
}

async function currentUid(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function readCache(uid: string): { dataUrl: string; updatedAt: string | null } | null {
  try {
    const cachedUid = localStorage.getItem(CACHE_USER_KEY);
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached && cachedUid === uid) {
      return { dataUrl: cached, updatedAt: localStorage.getItem(CACHE_UPDATED_KEY) };
    }
    // Migrate from legacy session cache if present and matches uid.
    const legacyUid = sessionStorage.getItem(LEGACY_USER_KEY);
    const legacy = sessionStorage.getItem(LEGACY_CACHE_KEY);
    if (legacy && legacyUid === uid) {
      try {
        localStorage.setItem(CACHE_KEY, legacy);
        localStorage.setItem(CACHE_USER_KEY, uid);
      } catch { /* quota */ }
      return { dataUrl: legacy, updatedAt: null };
    }
  } catch { /* storage unavailable */ }
  return null;
}

function writeCache(uid: string, dataUrl: string, updatedAt?: string | null) {
  try {
    localStorage.setItem(CACHE_KEY, dataUrl);
    localStorage.setItem(CACHE_USER_KEY, uid);
    if (updatedAt) localStorage.setItem(CACHE_UPDATED_KEY, updatedAt);
    else localStorage.removeItem(CACHE_UPDATED_KEY);
  } catch { /* quota / private mode */ }
}


/** Returns true if the current user has a signature on file. Reads profile only. */
export async function hasSignature(): Promise<boolean> {
  const uid = await currentUid();
  if (!uid) return false;
  const { data } = await supabase
    .from("profiles")
    .select("signature_path")
    .eq("id", uid)
    .maybeSingle();
  return !!data?.signature_path;
}

export type SignatureLoadResult = {
  /** Data URL of the signature PNG, or null when none exists / cannot be fetched. */
  url: string | null;
  /** True when `profiles.signature_path` exists (i.e. signature is registered server-side). */
  hasRemotePointer: boolean;
  /** Populated only when remote pointer exists but the Storage download failed. */
  error: string | null;
  /** True when `url` came from the local cache (server fetch failed or skipped). */
  fromCache: boolean;
};

/**
 * Rich loader used by the signature manager UI. Falls back to the local cache
 * when the Storage download fails (offline / transient auth) instead of
 * silently returning `null` — which used to make users think their signature
 * had vanished.
 */
export async function loadSignature(): Promise<SignatureLoadResult> {
  const uid = await currentUid();
  if (!uid) {
    return { url: null, hasRemotePointer: false, error: null, fromCache: false };
  }

  const cached = readCache(uid);

  // Profile lookup — also pull updated_at to detect remote changes.
  let signaturePath: string | null = null;
  let signatureUpdatedAt: string | null = null;
  let profileErr: string | null = null;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("signature_path, signature_updated_at")
      .eq("id", uid)
      .maybeSingle();
    if (error) profileErr = error.message;
    signaturePath = data?.signature_path ?? null;
    signatureUpdatedAt = (data as any)?.signature_updated_at ?? null;
  } catch (e: any) {
    profileErr = e?.message || "profile_lookup_failed";
  }

  // No registered signature server-side
  if (!signaturePath) {
    if (profileErr && cached) {
      return { url: cached.dataUrl, hasRemotePointer: false, error: profileErr, fromCache: true };
    }
    if (!profileErr && cached) clearSignatureCache();
    return { url: null, hasRemotePointer: false, error: profileErr, fromCache: false };
  }

  // If cache exists AND server timestamp matches → reuse cache, skip download.
  if (cached && signatureUpdatedAt && cached.updatedAt === signatureUpdatedAt) {
    return { url: cached.dataUrl, hasRemotePointer: true, error: null, fromCache: true };
  }

  // Cache is stale (or missing, or server is newer) → download fresh.
  try {
    const { data, error } = await supabase
      .storage
      .from("signatures")
      .download(signaturePath);
    if (error || !data) {
      const msg = error?.message || "download_failed";
      if (cached) {
        return { url: cached.dataUrl, hasRemotePointer: true, error: msg, fromCache: true };
      }
      return { url: null, hasRemotePointer: true, error: msg, fromCache: false };
    }
    const dataUrl = await blobToDataUrl(data);
    writeCache(uid, dataUrl, signatureUpdatedAt);
    return { url: dataUrl, hasRemotePointer: true, error: null, fromCache: false };
  } catch (e: any) {
    const msg = e?.message || "download_failed";
    if (cached) {
      return { url: cached.dataUrl, hasRemotePointer: true, error: msg, fromCache: true };
    }
    return { url: null, hasRemotePointer: true, error: msg, fromCache: false };
  }
}

/**
 * Returns the signature as a `data:image/png;base64,...` string, or null if
 * none. Backward-compatible thin wrapper around `loadSignature()`.
 */
export async function getSignatureDataUrl(): Promise<string | null> {
  const { url } = await loadSignature();
  return url;
}

/** Uploads a PNG blob and updates the profile pointer. Returns the
 *  `signature_updated_at` timestamp that was written, so callers can prime
 *  the cache with the exact same value the server holds. */
export async function saveSignature(blob: Blob): Promise<{ updatedAt: string }> {
  const uid = await currentUid();
  if (!uid) throw new Error("not_authenticated");
  const path = pathFor(uid);
  const { error: upErr } = await supabase
    .storage
    .from("signatures")
    .upload(path, blob, { upsert: true, contentType: "image/png", cacheControl: "0" });
  if (upErr) throw upErr;

  const updatedAt = new Date().toISOString();
  const { error: profErr } = await supabase
    .from("profiles")
    .update({ signature_path: path, signature_updated_at: updatedAt })
    .eq("id", uid);
  if (profErr) throw profErr;
  // Record the local prime window so the echo UPDATE event we just produced
  // doesn't trigger an immediate Storage round-trip on this same device.
  lastLocalPrimeAt = Date.now();
  lastLocalUpdatedAt = updatedAt;
  return { updatedAt };
}

export async function deleteSignature(): Promise<void> {
  const uid = await currentUid();
  if (!uid) throw new Error("not_authenticated");
  await supabase.storage.from("signatures").remove([pathFor(uid)]);
  await supabase
    .from("profiles")
    .update({ signature_path: null, signature_updated_at: null })
    .eq("id", uid);
  clearSignatureCache();
  lastLocalPrimeAt = Date.now();
  lastLocalUpdatedAt = null;
  signatureBus.emit();
}

export function clearSignatureCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_USER_KEY);
    localStorage.removeItem(CACHE_UPDATED_KEY);
    sessionStorage.removeItem(LEGACY_CACHE_KEY);
    sessionStorage.removeItem(LEGACY_USER_KEY);
  } catch { /* noop */ }
}

/** Quietly ensure the local cache holds the latest signature. Safe to call
 *  on every login / app resume — no UI side effects. */
export async function preloadSignature(): Promise<void> {
  try { await loadSignature(); } catch { /* noop */ }
}

// Note: verifySignatureFresh and the diagnostics layer were removed.
// Cross-device sync now relies on React Query invalidation triggered by the
// global RealtimeSync channel (see src/lib/realtimeSync.tsx).
void isRecentLocalPrime; // retained for potential future use




/** Returns the last known server `signature_updated_at` from local cache. */
export function getCachedSignatureUpdatedAt(): string | null {
  try { return localStorage.getItem(CACHE_UPDATED_KEY); } catch { return null; }
}


/** Seed the cache with a freshly-saved data URL so subsequent reads
 *  (e.g. receipt PDF generation, page reloads, next-day launches) don't need
 *  to round-trip through Storage.
 *
 *  Does NOT emit `signatureBus` — the caller already has the new data and
 *  notifying other listeners on the same device causes a redundant Storage
 *  download that races with the just-completed upload. Cross-device listeners
 *  still fire through Realtime. */
export async function primeSignatureCache(dataUrl: string, updatedAt?: string): Promise<void> {
  const uid = await currentUid();
  if (!uid) return;
  const ts = updatedAt || new Date().toISOString();
  writeCache(uid, dataUrl, ts);
  lastLocalPrimeAt = Date.now();
  lastLocalUpdatedAt = ts;
}


