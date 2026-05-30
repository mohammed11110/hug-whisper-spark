import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Download, RotateCcw, Loader2 } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Yellow read-only banner shown when the user's subscription has ended but
 * their data is still kept (grace period). Mounted globally in AppShell.
 */
export function GraceBanner() {
  const { phase, dataDeleteAt, graceDaysLeft, refresh } = useSubscription();
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Tick once a minute so countdown stays fresh
  useEffect(() => {
    if (phase !== "grace") return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [phase]);

  const liveDaysLeft = useMemo(() => {
    if (!dataDeleteAt) return graceDaysLeft;
    return Math.max(0, Math.ceil((dataDeleteAt.getTime() - now) / 86_400_000));
  }, [dataDeleteAt, graceDaysLeft, now]);

  const reactivate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal", {
        body: { environment: "live" },
      });
      if (error || !data?.url) throw new Error(error?.message || "no_url");
      window.open(data.url, "_blank", "noopener,noreferrer");
      // Refresh shortly after — webhook usually fires within seconds
      setTimeout(refresh, 3000);
    } catch {
      toast.error(ar ? "تعذّر فتح بوابة الإدارة" : "Couldn't open portal");
    } finally {
      setLoading(false);
    }
  };

  if (phase !== "grace") return null;

  return (
    <div className="sticky top-0 z-50 bg-[#fdf4e2] border-b border-[#b8895a]/30 shadow-[0_2px_12px_-4px_rgba(184,137,90,0.25)]">
      <div className="max-w-[1280px] mx-auto px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="p-2 rounded-xl bg-terracotta/15 text-terracotta shrink-0">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sage-600 text-sm">
              {ar ? "انتهى اشتراكك — بياناتك محفوظة" : "Subscription ended — your data is kept"}
            </p>
            <p className="text-xs text-sage-500 mt-0.5">
              {ar
                ? `وضع القراءة فقط · ${liveDaysLeft} يوماً قبل الحذف النهائي`
                : `Read-only mode · ${liveDaysLeft} days until permanent deletion`}
            </p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Link
            to="/backup"
            className="flex items-center justify-center gap-1.5 bg-sage-500 hover:bg-sage-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors flex-1 sm:flex-initial"
          >
            <Download className="h-3.5 w-3.5" />
            {ar ? "تصدير بياناتي" : "Export my data"}
          </Link>
          <button
            onClick={reactivate}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 bg-gold hover:bg-gold/90 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors flex-1 sm:flex-initial disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 rtl:scale-x-[-1]" />}
            {ar ? "إعادة التفعيل" : "Reactivate"}
          </button>
        </div>
      </div>
    </div>
  );
}
