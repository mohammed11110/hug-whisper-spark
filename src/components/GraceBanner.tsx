import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Download, RotateCcw, Loader2, Sparkles } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Unified banner for trial countdown + read-only grace.
 * - trial (>4 days left): subtle sage tint, soft reminder.
 * - trial (<=4 days):     gold prominence, subscribe CTA.
 * - readonly_grace / subscription_grace: terracotta, countdown to deletion + Export + Subscribe.
 */
export function LifecycleBanner() {
  const { phase, trialEndsAt, trialDaysLeft, graceEndsAt, dataDeleteAt, graceDaysLeft, refresh } = useSubscription();
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (phase === "active" || phase === "free" || phase === "deleted") return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [phase]);

  const liveTrialDays = useMemo(() => {
    if (!trialEndsAt) return trialDaysLeft;
    return Math.max(0, Math.ceil((trialEndsAt.getTime() - now) / 86_400_000));
  }, [trialEndsAt, trialDaysLeft, now]);

  const liveGraceDays = useMemo(() => {
    const target = graceEndsAt ?? dataDeleteAt;
    if (!target) return graceDaysLeft;
    return Math.max(0, Math.ceil((target.getTime() - now) / 86_400_000));
  }, [graceEndsAt, dataDeleteAt, graceDaysLeft, now]);

  const reactivate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal", {
        body: { environment: "live" },
      });
      if (error || !data?.url) throw new Error(error?.message || "no_url");
      window.open(data.url, "_blank", "noopener,noreferrer");
      setTimeout(refresh, 3000);
    } catch {
      // Fall back to pricing page if no existing portal session
      window.location.href = "/pricing";
    } finally {
      setLoading(false);
    }
  };

  if (phase === "active" || phase === "free" || phase === "deleted") return null;

  // TRIAL: only show banner in last 4 days
  if (phase === "trial") {
    if (liveTrialDays === null || liveTrialDays > 4) return null;
    const urgent = liveTrialDays <= 1;
    return (
      <div className={`sticky top-0 z-50 border-b ${urgent ? "bg-[#fbf4e0] border-gold/40" : "bg-sage-50 border-sage-200/40"}`}>
        <div className="max-w-[1280px] mx-auto px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`p-2 rounded-xl shrink-0 ${urgent ? "bg-gold/15 text-gold" : "bg-sage-100 text-sage-500"}`}>
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sage-600 text-sm">
                {ar
                  ? urgent ? "تنتهي تجربتك المجانية قريباً" : "تجربتك المجانية مستمرة"
                  : urgent ? "Your free trial ends soon" : "Your free trial"}
              </p>
              <p className="text-xs text-sage-500 mt-0.5">
                {ar
                  ? `${liveTrialDays} ${liveTrialDays === 1 ? "يوم" : "أيام"} متبقية — اشترك للاحتفاظ بجميع البيانات`
                  : `${liveTrialDays} ${liveTrialDays === 1 ? "day" : "days"} left — subscribe to keep all your data`}
              </p>
            </div>
          </div>
          <Link
            to="/pricing"
            className="flex items-center justify-center gap-1.5 bg-gold hover:bg-gold/90 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-colors w-full sm:w-auto"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {ar ? "اشترك الآن" : "Subscribe now"}
          </Link>
        </div>
      </div>
    );
  }

  // READONLY_GRACE / SUBSCRIPTION_GRACE
  const final7 = liveGraceDays !== null && liveGraceDays <= 7;
  return (
    <div className="sticky top-0 z-50 bg-[#fdf4e2] border-b border-terracotta/30 shadow-[0_2px_12px_-4px_rgba(184,137,90,0.25)]">
      <div className="max-w-[1280px] mx-auto px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="p-2 rounded-xl bg-terracotta/15 text-terracotta shrink-0">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sage-600 text-sm">
              {ar
                ? phase === "subscription_grace" ? "انتهى اشتراكك — بياناتك محفوظة" : "انتهت تجربتك — بياناتك محفوظة"
                : phase === "subscription_grace" ? "Subscription ended — your data is kept" : "Trial ended — your data is kept"}
            </p>
            <p className="text-xs text-sage-500 mt-0.5">
              {ar
                ? `وضع القراءة فقط · ${liveGraceDays} ${final7 ? "أيام فقط" : "يوماً"} متبقية`
                : `Read-only · ${liveGraceDays} ${final7 ? "days remaining" : "days left"}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Link
            to="/backup"
            className="flex items-center justify-center gap-1.5 bg-sage-100 hover:bg-sage-200 text-sage-600 text-xs font-bold px-4 py-2 rounded-xl transition-colors flex-1 sm:flex-initial"
          >
            <Download className="h-3.5 w-3.5" />
            {ar ? "تصدير" : "Export"}
          </Link>
          <button
            onClick={reactivate}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 bg-gold hover:bg-gold/90 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-colors flex-1 sm:flex-initial disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 rtl:scale-x-[-1]" />}
            {ar ? "اشترك الآن" : "Subscribe"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Legacy alias for any old imports
export const GraceBanner = LifecycleBanner;
