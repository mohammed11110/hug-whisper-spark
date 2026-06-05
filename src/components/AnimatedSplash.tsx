import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";

const HOLD_MS = 1800;
const FADE_MS = 300;
const REDUCED_HOLD_MS = 500;
const SESSION_KEY = "amlaki:splash-shown";

/**
 * Animated post-native splash overlay. Renders fullscreen on app mount,
 * hides the Capacitor native splash so it hands off seamlessly, then
 * auto-dismisses after ~1.8s (or instantly under prefers-reduced-motion).
 * Only shows once per session and only in standalone / native contexts.
 */
export function AnimatedSplash() {
  const [mounted, setMounted] = useState(() => shouldShowSplash());
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!mounted) return;
    sessionStorage.setItem(SESSION_KEY, "1");

    // Hand off from Capacitor native splash → animated splash.
    (async () => {
      try {
        const mod = await import("@capacitor/splash-screen");
        await mod.SplashScreen.hide({ fadeOutDuration: 150 });
      } catch {
        /* not on native or plugin unavailable — ignore */
      }
    })();

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const hold = reduced ? REDUCED_HOLD_MS : HOLD_MS;

    const t1 = window.setTimeout(() => setLeaving(true), hold);
    const t2 = window.setTimeout(() => setMounted(false), hold + FADE_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div
      aria-hidden="true"
      data-leaving={leaving ? "true" : "false"}
      className="amlaki-splash"
    >
      <div className="amlaki-splash__logo">
        <div className="amlaki-splash__logo-tile">
          <Logo size={68} />
        </div>
      </div>
      <div className="amlaki-splash__name">
        <h1>Amlaki</h1>
        <p dir="rtl">أملاكي</p>
      </div>
      <div className="amlaki-splash__tag">PROPERTY MANAGEMENT</div>
    </div>
  );
}

function shouldShowSplash(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(SESSION_KEY) === "1") return false;
  } catch {
    /* sessionStorage blocked — show anyway */
  }

  // Native Capacitor
  try {
    // dynamic-free check — avoid bundling cost
    const cap = (window as any).Capacitor;
    const platform = cap?.getPlatform?.();
    if (platform === "ios" || platform === "android") return true;
  } catch {
    /* noop */
  }

  // Installed PWA (standalone display mode)
  try {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (standalone) return true;
  } catch {
    /* noop */
  }

  return false;
}
