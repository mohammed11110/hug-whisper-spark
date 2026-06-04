// Lightweight platform detection helpers shared across the app.
// Keep these synchronous and dependency-free so they're cheap to call.

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ reports itself as MacIntel; touch points disambiguate from real Mac.
  return (
    navigator.platform === "MacIntel" &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1
  );
}

export function canShareFiles(files: File[]): boolean {
  try {
    return (
      typeof navigator !== "undefined" &&
      typeof (navigator as any).canShare === "function" &&
      (navigator as any).canShare({ files })
    );
  } catch {
    return false;
  }
}
