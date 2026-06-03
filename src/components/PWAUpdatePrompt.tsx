import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

/**
 * Tiny toast that surfaces when a new service-worker version is ready.
 * Registration itself happens in `src/main.tsx` with preview/Capacitor guards.
 * This component just listens for a custom event dispatched from there.
 */
export function PWAUpdatePrompt() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [updateFn, setUpdateFn] = useState<null | (() => Promise<void>)>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ update: () => Promise<void> }>).detail;
      if (detail?.update) setUpdateFn(() => detail.update);
    };
    window.addEventListener("amlaki:sw-update-available", handler as EventListener);
    return () =>
      window.removeEventListener("amlaki:sw-update-available", handler as EventListener);
  }, []);

  if (!updateFn) return null;

  return (
    <div
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-md rounded-2xl bg-card shadow-elev border border-sage-200/50 p-4 flex items-center gap-3 motion-safe:animate-float-up"
      role="status"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
        <RefreshCw className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">
          {ar ? "تحديث جديد متاح" : "A new version is ready"}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {ar ? "أعد التحميل لتحصل على أحدث إصدار" : "Reload to get the latest version"}
        </p>
      </div>
      <Button
        onClick={() => updateFn?.()}
        className="h-9 px-3 rounded-xl text-sm shrink-0"
      >
        {ar ? "تحديث" : "Update"}
      </Button>
      <button
        type="button"
        onClick={() => setUpdateFn(null)}
        className="text-muted-foreground hover:text-foreground p-1 shrink-0"
        aria-label={ar ? "إغلاق" : "Dismiss"}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
