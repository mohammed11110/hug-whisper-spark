import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/** Slim banner shown when the browser loses network connectivity. */
export function OfflineBanner() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" && !navigator.onLine,
  );

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      className="sticky top-0 z-50 w-full bg-terracotta/10 border-b border-terracotta/30 text-terracotta px-4 py-2 flex items-center justify-center gap-2 text-xs font-semibold"
      role="status"
      style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
    >
      <WifiOff className="h-3.5 w-3.5" />
      {ar ? "أنت غير متصل بالإنترنت — التغييرات لن تُحفظ" : "You're offline — changes won't save"}
    </div>
  );
}
