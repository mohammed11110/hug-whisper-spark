import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { hasSeenTour, startTour } from "@/lib/tour";

const ONBOARDING_SEEN = "amlaki_onboarding_seen_v1";

export function TourLauncher() {
  const { user, loading } = useAuth();
  const { lang } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const started = useRef(false);

  useEffect(() => {
    if (loading || !user || started.current) return;
    if (location.pathname === "/welcome" || location.pathname === "/auth") return;
    if (hasSeenTour()) return;

    // Wait until the welcome modal has been dismissed before starting the tour.
    const tryStart = () => {
      const welcomeDismissed = localStorage.getItem(ONBOARDING_SEEN) === "1";
      if (!welcomeDismissed) return false;
      started.current = true;
      setTimeout(() => {
        startTour({
          navigate: (p) => navigate(p),
          currentPath: window.location.pathname,
          lang: lang === "ar" ? "ar" : "en",
        });
      }, 600);
      return true;
    };

    if (tryStart()) return;
    const id = setInterval(() => { if (tryStart()) clearInterval(id); }, 800);
    return () => clearInterval(id);
  }, [user, loading, location.pathname, lang, navigate]);

  return null;
}
