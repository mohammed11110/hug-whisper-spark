import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ArrowUp } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const HIDDEN_PREFIXES = [
  "/auth", "/welcome", "/install", "/forgot-password", "/reset-password",
  "/pricing", "/admin", "/unsubscribe", "/privacy", "/terms", "/refund",
];

/**
 * Floating "scroll to top" button. Appears after the user scrolls down,
 * positioned at the opposite corner from the draggable payment FAB so they
 * never overlap. Lifts above the bottom nav on mobile.
 */
export function ScrollToTopButton() {
  const { lang, rtl } = useI18n();
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return null;
  }

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  return (
    <button
      type="button"
      aria-label={lang === "ar" ? "العودة إلى الأعلى" : "Scroll to top"}
      onClick={() =>
        window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" })
      }
      className={`fixed z-50 h-11 w-11 rounded-full flex items-center justify-center
        bg-card text-foreground border border-border shadow-elev
        transition-all duration-200 ease-out
        ${visible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none"}`}
      style={{
        // Opposite side from the FAB (FAB defaults to right). On RTL flip.
        [rtl ? "right" : "left"]: 16,
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 92px)",
      }}
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}
