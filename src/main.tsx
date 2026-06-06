import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { initSentry } from "./lib/sentry";
import { ErrorBoundary } from "./components/ErrorBoundary";

initSentry();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </HelmetProvider>
);

// ---------------------------------------------------------------------------
// PWA cleanup — kill-switch path.
// The previous build registered a Workbox service worker via vite-plugin-pwa
// that cached old hashed JS chunks. After a new deploy the cached worker
// kept serving stale assets, producing a white screen until the user fully
// closed every browser window.
//
// We now ship `public/sw.js` as a kill-switch worker that:
//   - deletes the old caches
//   - reloads open tabs onto fresh HTML
//   - unregisters itself
//
// This file just makes sure the new worker is registered exactly once on the
// production origin. We avoid registering in Lovable preview, in iframes,
// or inside Capacitor — service workers don't belong there.
// ---------------------------------------------------------------------------
(async () => {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const isInIframe = (() => {
    try { return window.self !== window.top; } catch { return true; }
  })();
  const host = window.location.hostname;
  const isPreviewHost =
    host.endsWith(".lovableproject.com") ||
    host.endsWith(".lovableproject-dev.com") ||
    host.startsWith("id-preview--") ||
    host.startsWith("preview--");
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
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (err) {
    console.warn("[SW] kill-switch registration failed", err);
  }
})();
