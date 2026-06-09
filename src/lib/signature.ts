/**
 * User signature: stored as a transparent PNG in Supabase Storage under
 * `signatures/{user_id}.png`. Cached as a data URL in sessionStorage so we
 * don't refetch on every receipt issue.
 *
 * One file per user — saving overwrites; deleting removes both the file and
 * the `signature_path` pointer on `profiles`.
 */
import { supabase } from "@/integrations/supabase/client";

const CACHE_KEY = "amlaki_signature_dataurl_v1";
const CACHE_USER_KEY = "amlaki_signature_uid_v1";

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

/**
 * Returns the signature as a `data:image/png;base64,...` string, or null if
 * none. Cached per session.
 */
export async function getSignatureDataUrl(): Promise<string | null> {
  const uid = await currentUid();
  if (!uid) return null;

  try {
    const cachedUid = sessionStorage.getItem(CACHE_USER_KEY);
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached && cachedUid === uid) return cached;
  } catch { /* sessionStorage may be unavailable */ }

  const { data: profile } = await supabase
    .from("profiles")
    .select("signature_path")
    .eq("id", uid)
    .maybeSingle();
  if (!profile?.signature_path) return null;

  const { data, error } = await supabase
    .storage
    .from("signatures")
    .download(profile.signature_path);
  if (error || !data) return null;
  const dataUrl = await blobToDataUrl(data);
  try {
    sessionStorage.setItem(CACHE_KEY, dataUrl);
    sessionStorage.setItem(CACHE_USER_KEY, uid);
  } catch { /* noop */ }
  return dataUrl;
}

/** Uploads a PNG blob and updates the profile pointer. */
export async function saveSignature(blob: Blob): Promise<void> {
  const uid = await currentUid();
  if (!uid) throw new Error("not_authenticated");
  const path = pathFor(uid);
  const { error: upErr } = await supabase
    .storage
    .from("signatures")
    .upload(path, blob, { upsert: true, contentType: "image/png", cacheControl: "0" });
  if (upErr) throw upErr;

  const { error: profErr } = await supabase
    .from("profiles")
    .update({ signature_path: path, signature_updated_at: new Date().toISOString() })
    .eq("id", uid);
  if (profErr) throw profErr;

  clearSignatureCache();
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
}

export function clearSignatureCache() {
  try {
    sessionStorage.removeItem(CACHE_KEY);
    sessionStorage.removeItem(CACHE_USER_KEY);
  } catch { /* noop */ }
}
