import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, Loader2, RefreshCw, ShieldCheck, Clock, AlertCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription, type AccountPhase } from "@/hooks/useSubscription";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { openExternal } from "@/lib/nativeFiles";
import { getPaddleEnvironment } from "@/lib/paddle";
import { toast } from "sonner";

type Variant = "active" | "grace" | "limited" | "frozen" | "none";

const PHASE_TO_VARIANT: Record<AccountPhase, Variant> = {
  active: "active",
  trial: "active",
  subscription_grace: "grace",
  readonly_grace: "limited",
  frozen: "frozen",
  deleted: "frozen",
  free: "none",
};

const VARIANT_STYLES: Record<Variant, { icon: any; chip: string; ring: string; dot: string }> = {
  active:  { icon: ShieldCheck,  chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", ring: "border-emerald-500/30", dot: "bg-emerald-500" },
  grace:   { icon: Clock,        chip: "bg-amber-500/10 text-amber-600 dark:text-amber-400",       ring: "border-amber-500/30",   dot: "bg-amber-500" },
  limited: { icon: AlertCircle,  chip: "bg-orange-500/10 text-orange-600 dark:text-orange-400",    ring: "border-orange-500/30",  dot: "bg-orange-500" },
  frozen:  { icon: Lock,         chip: "bg-rose-500/10 text-rose-600 dark:text-rose-400",          ring: "border-rose-500/30",    dot: "bg-rose-500" },
  none:    { icon: CreditCard,   chip: "bg-muted text-muted-foreground",                            ring: "border-border",         dot: "bg-muted-foreground" },
};

function interp(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? _);
}

export function BillingStatusSection() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const sub = useSubscription();
  const [portalLoading, setPortalLoading] = useState(false);
  const ar = lang === "ar";

  const variant: Variant = sub.loading ? "active" : PHASE_TO_VARIANT[sub.phase] ?? "none";
  const style = VARIANT_STYLES[variant];
  const Icon = style.icon;

  const label = (() => {
    switch (variant) {
      case "active":  return t("billing_status_active");
      case "grace":   return t("billing_status_grace");
      case "limited": return t("billing_status_limited");
      case "frozen":  return t("billing_status_frozen");
      default:        return t("billing_status_none");
    }
  })();

  const description = (() => {
    if (sub.loading) return t("loading");
    switch (variant) {
      case "active":
        if (sub.isTrialing) {
          const days = String(sub.trialDaysLeft ?? 0);
          return ar
            ? interp(t("billing_desc_trial"), { days })
            : `Free trial — ${days} day${days === "1" ? "" : "s"} left.`;
        }
        if (sub.currentPeriodEnd) {
          const date = sub.currentPeriodEnd.toLocaleDateString(ar ? "ar" : "en");
          return sub.cancelAtPeriodEnd
            ? interp(t("billing_desc_ends"), { date })
            : interp(t("billing_desc_renews"), { date });
        }
        return t("billing_desc_active");
      case "grace":
        return t("billing_desc_grace");
      case "limited":
        return t("billing_desc_limited");
      case "frozen":
        return t("billing_desc_frozen");
      default:
        return t("billing_desc_none");
    }
  })();

  const openPortal = async () => {
    if (!sub.paddleSubscriptionId) {
      navigate("/pricing");
      return;
    }
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal", {
        body: { environment: getPaddleEnvironment() },
      });
      if (error || !data?.url) throw new Error("no_url");
      await openExternal(data.url);
      setTimeout(sub.refresh, 3000);
    } catch {
      toast.error(t("couldnt_open_portal"));
    } finally {
      setPortalLoading(false);
    }
  };

  const renew = () => {
    if (sub.paddleSubscriptionId) {
      openPortal();
    } else {
      navigate("/pricing");
    }
  };

  const showRenew = variant === "grace" || variant === "limited" || variant === "frozen" || variant === "none";
  const showUpdatePayment = variant === "active" || variant === "grace";

  return (
    <section className="px-5 md:px-8 lg:px-12 mt-3">
      <div className={`rounded-2xl bg-card border-2 ${style.ring} p-4`}>
        <div className="flex items-start gap-3">
          <div className={`h-10 w-10 rounded-xl grid place-items-center shrink-0 ${style.chip}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-sm text-foreground">
                {t("billing_status")}
              </h3>
              <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${style.chip}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                {label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              {description}
            </p>

            <div className="flex flex-wrap gap-2 mt-3">
              {showUpdatePayment && (
                <Button
                  onClick={openPortal}
                  disabled={portalLoading || sub.loading}
                  size="sm"
                  variant={variant === "grace" ? "default" : "outline"}
                  className="rounded-xl h-9"
                >
                  {portalLoading ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <CreditCard className="h-4 w-4 me-2" />}
                  {t("update_payment_method")}
                </Button>
              )}
              {showRenew && (
                <Button
                  onClick={renew}
                  disabled={portalLoading || sub.loading}
                  size="sm"
                  className="rounded-xl h-9 bg-gold hover:bg-gold/90 text-white"
                >
                  {portalLoading ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <RefreshCw className="h-4 w-4 me-2" />}
                  {t("renew_now")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
