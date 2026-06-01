import { HelpCircle, Compass, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n";
import { resetTour, startTour } from "@/lib/tour";

const ONBOARDING_SEEN = "amlaki_onboarding_seen_v1";

export function HelpMenu() {
  const { lang } = useI18n();
  const navigate = useNavigate();
  const ar = lang === "ar";

  const runTour = () => {
    resetTour();
    startTour({
      navigate: (p) => navigate(p),
      currentPath: window.location.pathname,
      lang: ar ? "ar" : "en",
    });
  };

  const replayWelcome = () => {
    try { localStorage.removeItem(ONBOARDING_SEEN); } catch {}
    window.location.reload();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full h-9 w-9"
          aria-label={ar ? "مساعدة" : "Help"}
        >
          <HelpCircle className="h-4 w-4 text-sage-500" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-2xl border-sage-200/60">
        <DropdownMenuItem onClick={runTour} className="gap-2 rounded-xl cursor-pointer">
          <Compass className="h-4 w-4 text-sage-500" />
          <span>{ar ? "بدء الجولة التعريفية" : "Start guided tour"}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={replayWelcome} className="gap-2 rounded-xl cursor-pointer">
          <Sparkles className="h-4 w-4 text-sage-500" />
          <span>{ar ? "إعادة عرض الترحيب" : "Replay welcome"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
