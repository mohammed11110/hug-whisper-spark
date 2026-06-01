import { supabase } from "@/integrations/supabase/client";

const BUCKET = "maintenance-photos";
const PUBLIC_MARKER = `/storage/v1/object/public/${BUCKET}/`;

/**
 * Given a stored value that may be either:
 *  - a legacy public URL (https://…/storage/v1/object/public/maintenance-photos/<path>), or
 *  - a storage path (uid/timestamp-rand.ext) written after the bucket was made private,
 * resolves to a short-lived signed URL that works regardless.
 *
 * Falls back to the input string if signing fails (so the UI can still render
 * a broken-image hint instead of nothing).
 */
export async function resolveMaintenancePhotoUrl(value: string, ttlSeconds = 3600): Promise<string> {
  if (!value) return value;
  let path = value;
  const idx = value.indexOf(PUBLIC_MARKER);
  if (idx !== -1) path = value.slice(idx + PUBLIC_MARKER.length);
  if (/^https?:\/\//i.test(path)) return path; // unknown URL — leave as-is

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, ttlSeconds);
  if (error || !data?.signedUrl) return value;
  return data.signedUrl;
}
