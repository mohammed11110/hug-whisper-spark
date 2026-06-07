import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, RotateCcw, Loader2, Sparkles, Clock, Lock } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { openExternal } from "@/lib/nativeFiles";

/**
 * Unified billing banner.
 * Calm, reassuring copy — NEVER mentions data deletion (data is preserved
 * indefinitely; only access is gated).
 *
 * Variants:
 *  - trial (≤4d left)             — soft amber, subscribe CTA
 *  - renewal_soon (≤3d to renew)  — soft info, manage payment method
 *  - readonly_grace / subscription_grace — limited, calm amber
 *  - frozen                       — neutral, "data is safe, renew to restore"
 */
export function LifecycleBanner() {
  const {
    phase,
    trialEndsAt,
    trialDaysLeft,
    graceEndsAt,
    dataDeleteAt,
    graceDaysLeft,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    paddleSubscriptionId,
    refresh,
  } = useSubscription();
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const liveTrialDays = useMemo(() => {
    if (!trialEndsAt) return trialDaysLeft;
    return Math.max(0, Math.ceil((trialEndsAt.getTime() - now) / 86_400_000));
  }, [trialEndsAt, trialDaysLeft, now]);

  const liveGraceDays = useMemo(() => {
    const target = graceEndsAt ?? dataDeleteAt;
    if (!target) return graceDaysLeft;
    return Math.max(0, Math.ceil((target.getTime() - now) / 86_400_000));
  }, [graceEndsAt, dataDeleteAt, graceDaysLeft, now]);

  const daysToRenewal = useMemo(() => {
    if (!currentPeriodEnd) return null;
    return Math.ceil((currentPeriodEnd.getTime() - now) / 86_400_000);
  }, [currentPeriodEnd, now]);

  const reactivate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal", {
        body: { environment: "live" },
      });
      if (error || !data?.url) throw new Error(error?.message || "no_url");
      await openExternal(data.url);
      setTimeout(refresh, 3000);
    } catch {
      window.location.href = "/pricing";
    } finally {
      setLoading(false);
    }
  };

  // PHASE: free / deleted (legacy) → nothing
  if (phase === "free" || phase === "deleted") return null;

  // TRIAL — only nudge in last 4 days
  if (phase === "trial") {
    if (liveTrialDays === null || liveTrialDays > 4) return null;
    const urgent = liveTrialDays <= 1;
    return (
      <BannerShell tone={urgent ? "gold" : "soft"}>
        <Icon tone={urgent ? "gold" : "soft"}>
          <Sparkles className="h-4 w-4" />
        </Icon>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-foreground text-sm">
            {ar
              ? urgent ? "تنتهي تجربتك المجانية قريباً" : "تجربتك المجانية مستمرة"
              : urgent ? "Your free trial ends soon" : "Your free trial"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {ar
              ? `${liveTrialDays} ${liveTrialDays === 1 ? "يوم" : "أيام"} متبقية — اشترك للاحتفاظ بكامل الوصول`
              : `${liveTrialDays} ${liveTrialDays === 1 ? "day" : "days"} left — subscribe to keep full access`}
          </p>
        </div>
        <PrimaryAction to="/pricing">
          <Sparkles className="h-3.5 w-3.5" />
          {ar ? "اشترك الآن" : "Subscribe now"}
        </PrimaryAction>
      </BannerShell>
    );
  }

  // ACTIVE — renewal reminder 3 days before
  if (phase === "active") {
    if (
      !paddleSubscriptionId ||
      cancelAtPeriodEnd ||
      daysToRenewal === null ||
      daysToRenewal > 3 ||
      daysToRenewal < 0
    ) {
      return null;
    }
    return (
      <BannerShell tone="info">
        <Icon tone="info">
          <Clock className="h-4 w-4" />
        </Icon>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-foreground text-sm">
            {ar
              ? `اشتراكك يُجدّد خلال ${daysToRenewal} ${daysToRenewal === 1 ? "يوم" : "أيام"}`
              : `Your subscription renews in ${daysToRenewal} ${daysToRenewal === 1 ? "day" : "days"}`}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {ar
              ? "تأكّد من تحديث طريقة الدفع لتفادي أي انقطاع."
              : "Make sure your payment method is up to date to avoid interruption."}
          </p>
        </div>
        <SecondaryAction onClick={reactivate} loading={loading}>
          {ar ? "تحديث الدفع" : "Update payment"}
        </SecondaryAction>
      </BannerShell>
    );
  }

  // READONLY_GRACE / SUBSCRIPTION_GRACE — limited but calm
  if (phase === "readonly_grace" || phase === "subscription_grace") {
    return (
      <BannerShell tone="gold">
        <Icon tone="gold">
          <Lock className="h-4 w-4" />
        </Icon>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-foreground text-sm">
            {ar ? "حسابك في وضع محدود مؤقتاً" : "Your account is temporarily limited"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {ar
              ? `بياناتك محفوظة بالكامل · جدّد لاستعادة كل الميزات${liveGraceDays !== null ? ` · ${liveGraceDays} يوم متبقّي في فترة السماح` : ""}`
              : `Your data is fully preserved — renew to restore all features${liveGraceDays !== null ? ` · ${liveGraceDays} days of grace remaining` : ""}`}
          </p>
        </div>
        <PrimaryAction onClick={reactivate} loading={loading}>
          <RotateCcw className="h-3.5 w-3.5 rtl:scale-x-[-1]" />
          {ar ? "جدّد الاشتراك" : "Renew"}
        </PrimaryAction>
      </BannerShell>
    );
  }

  // FROZEN — long inactivity, safe freeze
  if (phase === "frozen") {
    return (
      <BannerShell tone="neutral">
        <Icon tone="neutral">
          <ShieldCheck className="h-4 w-4" />
        </Icon>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-foreground text-sm">
            {ar ? "بياناتك محفوظة بأمان" : "Your data is safely stored"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {ar
              ? "جدّد في أي وقت لاستعادة كل شيء فوراً — لا شيء يُحذف."
              : "Renew anytime to instantly restore everything — nothing is ever deleted."}
          </p>
        </div>
        <PrimaryAction onClick={reactivate} loading={loading}>
          <RotateCcw className="h-3.5 w-3.5 rtl:scale-x-[-1]" />
          {ar ? "جدّد الآن" : "Renew"}
        </PrimaryAction>
      </BannerShell>
    );
  }

  return null;
}

// --- Shared sub-components -------------------------------------------------

type Tone = "soft" | "gold" | "info" | "neutral";

const TONE_BG: Record<Tone, string> = {
  soft: "bg-muted/60 border-border",
  gold: "bg-gold/10 border-gold/30",
  info: "bg-card border-border",
  neutral: "bg-muted/40 border-border",
};

const TONE_ICON: Record<Tone, string> = {
  soft: "bg-muted text-muted-foreground",
  gold: "bg-gold/20 text-gold",
  info: "bg-muted text-foreground",
  neutral: "bg-muted text-muted-foreground",
};

function BannerShell({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <div className={`sticky top-0 z-50 border-b ${TONE_BG[tone]}`}>
      <div className="max-w-[1280px] mx-auto px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {children}
      </div>
    </div>
  );
}

function Icon({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <div className={`p-2 rounded-xl shrink-0 ${TONE_ICON[tone]}`}>{children}</div>
  );
}

function PrimaryAction({
  to,
  onClick,
  loading,
  children,
}: {
  to?: string;
  onClick?: () => void;
  loading?: boolean;
  children: React.ReactNode;
}) {
  const cls =
    "flex items-center justify-center gap-1.5 bg-gold hover:bg-gold/90 text-primary-foreground text-xs font-bold px-5 py-2.5 rounded-xl transition-colors w-full sm:w-auto disabled:opacity-60";
  if (to) {
    return (
      <Link to={to} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button onClick={onClick} disabled={loading} className={cls}>
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : children}
    </button>
  );
}

function SecondaryAction({
  onClick,
  loading,
  children,
}: {
  onClick: () => void;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center justify-center gap-1.5 bg-card hover:bg-muted text-foreground text-xs font-bold px-5 py-2.5 rounded-xl border border-border transition-colors w-full sm:w-auto disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : children}
    </button>
  );
}

// Legacy alias
export const GraceBanner = LifecycleBanner;
