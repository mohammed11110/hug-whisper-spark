import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { initSentry } from "./lib/sentry";
import { ErrorBoundary } from "./components/ErrorBoundary";

initSentry();

// ---------------------------------------------------------------------------
// Recovery from stale lazy-loaded chunks after a new deploy.
// After Publish, the previous client may try to fetch old hashed JS files
// that no longer exist on the CDN, producing a white screen. We detect that
// specific class of error and trigger ONE safe reload (guarded with a session
// flag) so the user lands on the fresh bundle instead of a blank page.
// ---------------------------------------------------------------------------
const CHUNK_RELOAD_KEY = "amlaki:chunk-reload-once";
function isChunkLoadError(msg: unknown): boolean {
  const s = String(msg ?? "");
  return (
    s.includes("Failed to fetch dynamically imported module") ||
    s.includes("error loading dynamically imported module") ||
    s.includes("Importing a module script failed") ||
    /ChunkLoadError/i.test(s) ||
    /Loading chunk \d+ failed/i.test(s) ||
    /Loading CSS chunk/i.test(s)
  );
}
function recoverFromChunkError() {
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY) === "1") return;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
  } catch { /* ignore */ }
  // Hard reload bypassing the bfcache.
  window.location.reload();
}
window.addEventListener("error", (e) => {
  if (isChunkLoadError(e?.message) || isChunkLoadError((e as ErrorEvent).error?.message)) {
    recoverFromChunkError();
  }
});
window.addEventListener("unhandledrejection", (e) => {
  const reason = (e as PromiseRejectionEvent).reason;
  if (isChunkLoadError(reason?.message) || isChunkLoadError(reason)) {
    recoverFromChunkError();
  }
});

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </HelmetProvider>
);

// ---------------------------------------------------------------------------
// Service Worker registration (PWA)
// Guarded so it never runs inside:
//   - Lovable preview iframes (would cache the editor sandbox)
//   - Capacitor native app (uses its own WebView, no SW needed)
//   - Local dev (vite-plugin-pwa devOptions.enabled = false)
// ---------------------------------------------------------------------------
(async () => {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const isInIframe = (() => {
    try { return window.self !== window.top; } catch { return true; }
  })();
  const host = window.location.hostname;
  const isPreviewHost =
    host.includes("lovableproject.com") ||
    host.includes("lovable.app") && host.includes("id-preview--") ||
    host.includes("id-preview--");
  const isCapacitor = !!(window as unknown as { Capacitor?: unknown }).Capacitor;

  if (isInIframe || isPreviewHost || isCapacitor) {
    // Clean up any stale registrations in environments that shouldn't run a SW.
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    } catch { /* noop */ }
    return;
  }

  try {
    const { registerSW } = await import("virtual:pwa-register");
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        window.dispatchEvent(
          new CustomEvent("amlaki:sw-update-available", {
            detail: { update: () => updateSW(true) },
          }),
        );
      },
    });
  } catch (err) {
    console.warn("[PWA] registration failed", err);
  }
})();
