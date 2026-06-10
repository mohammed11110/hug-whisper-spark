/**
 * Business brand (institution info + logo) is tied to the account so it
 * follows the user across devices — mirroring how `signature.ts` works.
 *
 * Text fields live as columns on `profiles` (brand_name, brand_phone,
 * brand_address, brand_landlord_name, brand_landlord_name_en).
 * The logo PNG/JPEG lives in the public `branding` Storage bucket at
 * `{user_id}.png`, with `profiles.brand_logo_path` pointing at it.
 *
 * A local cache (localStorage) keeps the brand available offline and on first
 * paint; the server is the source of truth and replaces the cache on login.
 */
import { supabase } from "@/integrations/supabase/client";

export interface BrandData {
  name: string;
  phone: string;
  address: string;
  landlordName?: string;
  landlordNameEn?: string;
  logo: string | null; // data URL or public URL
}

const LOGO_CACHE_KEY = "amlaki_brand_logo_dataurl_v1";
const LOGO_UID_KEY = "amlaki_brand_logo_uid_v1";

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

function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const [meta, b64] = dataUrl.split(",");
    if (!meta || !b64) return null;
    const mime = /data:([^;]+);base64/.exec(meta)?.[1] || "image/png";
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  } catch {
    return null;
  }
}

function readLogoCache(uid: string): string | null {
  try {
    if (localStorage.getItem(LOGO_UID_KEY) === uid) {
      return localStorage.getItem(LOGO_CACHE_KEY);
    }
  } catch { /* noop */ }
  return null;
}

function writeLogoCache(uid: string, dataUrl: string | null) {
  try {
    if (dataUrl) {
      localStorage.setItem(LOGO_CACHE_KEY, dataUrl);
      localStorage.setItem(LOGO_UID_KEY, uid);
    } else {
      localStorage.removeItem(LOGO_CACHE_KEY);
      localStorage.removeItem(LOGO_UID_KEY);
    }
  } catch { /* noop */ }
}

export function clearBrandCache() {
  try {
    localStorage.removeItem(LOGO_CACHE_KEY);
    localStorage.removeItem(LOGO_UID_KEY);
  } catch { /* noop */ }
}

/** Returns the brand as stored on the server, or null if no profile / not signed in. */
export async function loadBrand(): Promise<BrandData | null> {
  const uid = await currentUid();
  if (!uid) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("brand_name, brand_phone, brand_address, brand_landlord_name, brand_landlord_name_en, brand_logo_path")
    .eq("id", uid)
    .maybeSingle();
  if (error || !data) return null;

  let logo: string | null = readLogoCache(uid);
  if (data.brand_logo_path) {
    try {
      const { data: blob } = await supabase.storage.from("branding").download(data.brand_logo_path);
      if (blob) {
        logo = await blobToDataUrl(blob);
        writeLogoCache(uid, logo);
      }
    } catch { /* fall back to cache */ }
  } else {
    // No logo on server — clear stale cache
    if (logo) { writeLogoCache(uid, null); logo = null; }
  }

  return {
    name: data.brand_name ?? "",
    phone: data.brand_phone ?? "",
    address: data.brand_address ?? "",
    landlordName: data.brand_landlord_name ?? "",
    landlordNameEn: data.brand_landlord_name_en ?? "",
    logo,
  };
}

/** Persists text fields on the profile. Logo is handled separately. */
export async function saveBrandFields(patch: Partial<Omit<BrandData, "logo">>): Promise<void> {
  const uid = await currentUid();
  if (!uid) return;
  const row: {
    brand_name?: string | null;
    brand_phone?: string | null;
    brand_address?: string | null;
    brand_landlord_name?: string | null;
    brand_landlord_name_en?: string | null;
    brand_updated_at: string;
  } = { brand_updated_at: new Date().toISOString() };
  if (patch.name !== undefined) row.brand_name = patch.name || null;
  if (patch.phone !== undefined) row.brand_phone = patch.phone || null;
  if (patch.address !== undefined) row.brand_address = patch.address || null;
  if (patch.landlordName !== undefined) row.brand_landlord_name = patch.landlordName || null;
  if (patch.landlordNameEn !== undefined) row.brand_landlord_name_en = patch.landlordNameEn || null;
  await supabase.from("profiles").update(row).eq("id", uid);
}

/** Uploads (or replaces) the logo. Accepts a data URL or a Blob. Returns the data URL. */
export async function uploadBrandLogo(input: string | Blob): Promise<string | null> {
  const uid = await currentUid();
  if (!uid) return null;
  const blob = input instanceof Blob ? input : dataUrlToBlob(input);
  if (!blob) return null;
  const ext = blob.type.includes("jpeg") ? "jpg" : "png";
  const path = `${uid}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("branding")
    .upload(path, blob, { upsert: true, contentType: blob.type || "image/png", cacheControl: "0" });
  if (upErr) return null;

  await supabase.from("profiles")
    .update({ brand_logo_path: path, brand_updated_at: new Date().toISOString() })
    .eq("id", uid);

  const dataUrl = await blobToDataUrl(blob);
  writeLogoCache(uid, dataUrl);
  return dataUrl;
}

export async function deleteBrandLogo(): Promise<void> {
  const uid = await currentUid();
  if (!uid) return;
  const { data } = await supabase.from("profiles").select("brand_logo_path").eq("id", uid).maybeSingle();
  const path = data?.brand_logo_path;
  if (path) {
    try { await supabase.storage.from("branding").remove([path]); } catch { /* noop */ }
  }
  await supabase.from("profiles")
    .update({ brand_logo_path: null, brand_updated_at: new Date().toISOString() })
    .eq("id", uid);
  writeLogoCache(uid, null);
}
