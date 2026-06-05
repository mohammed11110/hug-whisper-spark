// Native file actions for Capacitor (iOS/Android). On web these helpers
// fall back to browser-standard behavior. iOS's WKWebView ignores
// <a download>, blocks most popups, and can't run AirPrint via
// window.print() — so we write the file to the cache directory, then
// hand it to the OS via the Share sheet (Save to Files, AirPrint,
// AirDrop, Mail, WhatsApp...) or open it in the native PDF viewer.

import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Browser } from "@capacitor/browser";

export type NativePlatform = "web" | "ios" | "android";

export function getPlatform(): NativePlatform {
  try {
    return Capacitor.getPlatform() as NativePlatform;
  } catch {
    return "web";
  }
}

export function isNative(): boolean {
  const p = getPlatform();
  return p === "ios" || p === "android";
}

/** Convert a Blob to a base64 string (no data: prefix). */
async function blobToBase64(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Sanitize filename — strip path separators / control chars. */
function safeName(name: string): string {
  return (name || "document.pdf").replace(/[\/\\?%*:|"<>\x00-\x1f]/g, "_").slice(0, 120);
}

/**
 * Write a Blob (PDF, CSV, ...) to the device cache directory and return
 * its native file URI. Throws on non-native platforms.
 */
export async function writeBlobToCache(blob: Blob, filename: string): Promise<string> {
  if (!isNative()) throw new Error("writeBlobToCache is native-only");
  const data = await blobToBase64(blob);
  const path = safeName(filename);
  await Filesystem.writeFile({ path, data, directory: Directory.Cache });
  const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
  return uri;
}

/**
 * Native share sheet for a generated Blob — lets the user Save to Files,
 * AirPrint, AirDrop, send to WhatsApp/Mail, etc. Falls back to true on
 * success / false if cancelled. Throws on real failures.
 */
export async function shareBlobNative(
  blob: Blob,
  filename: string,
  opts?: { title?: string; mimeType?: string }
): Promise<boolean> {
  const url = await writeBlobToCache(blob, filename);
  try {
    await Share.share({
      title: opts?.title || filename,
      url,
      dialogTitle: opts?.title || filename,
    });
    return true;
  } catch (e: any) {
    // User-cancel is not a real error — Capacitor throws a generic message.
    const msg = String(e?.message || e || "").toLowerCase();
    if (msg.includes("cancel") || msg.includes("dismiss")) return false;
    throw e;
  }
}

/**
 * Open a Blob (PDF) in the native in-app browser/PDF viewer. iOS users get
 * the standard preview with built-in Share / AirPrint actions.
 */
export async function previewBlobNative(blob: Blob, filename: string): Promise<void> {
  const url = await writeBlobToCache(blob, filename);
  await Browser.open({ url });
}

/**
 * Convenience: route a generated PDF Blob to the correct sink depending
 * on platform and intent. On web, the caller should keep its existing
 * browser flow (jsPDF.save / window.open / window.print).
 *
 *   intent = "save"    → native Share sheet (Save to Files)
 *   intent = "preview" → native PDF viewer
 *   intent = "print"   → native Share sheet (AirPrint lives there)
 */
export async function handlePdfBlobNative(
  blob: Blob,
  filename: string,
  intent: "save" | "preview" | "print",
  opts?: { title?: string }
): Promise<boolean> {
  if (!isNative()) return false;
  if (intent === "preview") {
    await previewBlobNative(blob, filename);
    return true;
  }
  return await shareBlobNative(blob, filename, { title: opts?.title, mimeType: "application/pdf" });
}

/**
 * Open an external URL. On native (iOS/Android Capacitor WebView) uses the
 * in-app system browser (which can return to the app). On web falls back to
 * `window.open` in a new tab.
 */
export async function openExternal(url: string): Promise<void> {
  if (!url) return;
  if (isNative()) {
    try { await Browser.open({ url }); return; } catch { /* fall through */ }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Save an arbitrary Blob. On native opens the Share sheet (Save to Files /
 * AirDrop / Mail / WhatsApp). On web triggers a standard `<a download>`.
 */
export async function saveBlobUniversal(
  blob: Blob,
  filename: string,
  opts?: { title?: string }
): Promise<void> {
  if (isNative()) {
    await shareBlobNative(blob, filename, { title: opts?.title || filename });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Save a JSON-serializable object as a downloaded/shared file. */
export async function saveJsonUniversal(
  obj: unknown,
  filename: string
): Promise<void> {
  const name = filename.endsWith(".json") ? filename : `${filename}.json`;
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  await saveBlobUniversal(blob, name, { title: name });
}
