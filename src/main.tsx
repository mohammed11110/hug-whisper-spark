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
