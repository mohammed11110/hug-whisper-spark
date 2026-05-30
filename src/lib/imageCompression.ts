import imageCompression from "browser-image-compression";

const IMAGE_RE = /^image\/(png|jpe?g|webp|gif|heic|heif)$/i;
const SKIP_BELOW = 200 * 1024; // 200KB

/**
 * Compress an image to ≤1MB / 1920px max edge, preserving aspect ratio.
 * Non-image files and tiny images pass through unchanged.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file || !IMAGE_RE.test(file.type)) return file;
  if (file.size <= SKIP_BELOW) return file;
  try {
    const out = await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      preserveExif: false,
    });
    // browser-image-compression returns a Blob in some envs; normalize to File.
    if (out instanceof File) return out;
    return new File([out], file.name, { type: out.type || file.type, lastModified: Date.now() });
  } catch (e) {
    console.warn("[imageCompression] falling back to original:", e);
    return file;
  }
}
