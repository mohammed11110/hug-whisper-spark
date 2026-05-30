import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "amlaki:install-dismissed-at";
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Subtle "Add to Home Screen" prompt. Appears on Android/Chromium
 * after `beforeinstallprompt`. iOS has no programmatic install — for
 * Safari we direct users to the dedicated /install page.
 */
export function InstallPrompt() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (Date.now() - dismissedAt < DISMISS_TTL_MS) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const install = async () => {
    if (!evt) return;
    await evt.prompt();
    await evt.userChoice;
    dismiss();
  };

  if (!visible || !evt) return null;

  return (
    <div
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl bg-card shadow-elev border border-sage-200/50 p-4 flex items-center gap-3 motion-safe:animate-float-up"
      role="dialog"
      aria-label={ar ? "تثبيت التطبيق" : "Install app"}
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
        <Download className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">
          {ar ? "ثبّت أملاكي على شاشتك" : "Install Amlaki to your home screen"}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {ar ? "وصول أسرع · يعمل دون اتصال" : "Faster access · works offline"}
        </p>
      </div>
      <Button onClick={install} className="h-9 px-3 rounded-xl text-sm shrink-0">
        {ar ? "تثبيت" : "Install"}
      </Button>
      <button
        type="button"
        onClick={dismiss}
        className="text-muted-foreground hover:text-foreground p-1 shrink-0"
        aria-label={ar ? "إغلاق" : "Dismiss"}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
