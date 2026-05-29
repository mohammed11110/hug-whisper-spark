import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useSubscription, ADDON_UNIT_PRICE, PLAN_UNIT_LIMITS, type PlanTier } from "@/hooks/useSubscription";
import { getPaddleEnvironment } from "@/lib/paddle";

const ADDON_OPTIONS = [1, 5, 10] as const;

/**
 * Shown when a user hits their plan's unit cap. Lets them buy +1, +5, or +10
 * additional units at the per-plan add-on price. After purchase, the parent
 * should retry whatever insert triggered the quota error.
 */
export function BuyAddonUnitsDialog({
  open,
  onOpenChange,
  onPurchased,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPurchased?: () => void;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const navigate = useNavigate();
  const sub = useSubscription();
  const [busy, setBusy] = useState<number | null>(null);

  const plan = sub.plan as PlanTier;
  const isFree = plan === "free" || !sub.isActive;
  const planLimit = PLAN_UNIT_LIMITS[plan] ?? PLAN_UNIT_LIMITS.free;
  const perUnit = ADDON_UNIT_PRICE[plan] ?? 0;

  const buy = async (qty: number) => {
    if (isFree) {
      onOpenChange(false);
      navigate("/pricing");
      return;
    }
    setBusy(qty);
    try {
      const { data, error } = await supabase.functions.invoke("add-subscription-units", {
        body: { quantity: qty, environment: getPaddleEnvironment() },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(ar ? `تمت إضافة ${qty} وحدة لاشتراكك` : `Added ${qty} unit${qty > 1 ? "s" : ""} to your plan`);
      await sub.refresh();
      onOpenChange(false);
      onPurchased?.();
    } catch (e: any) {
      toast.error(
        ar
          ? "تعذّر إضافة الوحدات. حاول من خلال إدارة الاشتراك."
          : "Couldn't add units. Try managing your subscription.",
      );
      console.error(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-black text-sage-600 text-xl flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-gold" />
            {ar ? "وصلت إلى حد الباقة" : "You've reached your plan limit"}
          </DialogTitle>
          <DialogDescription className="text-sm leading-6">
            {isFree
              ? ar
                ? `الباقة المجانية تتيح ${planLimit} وحدات فقط. رقّ خطتك للحصول على المزيد.`
                : `The Free plan allows only ${planLimit} units. Upgrade to add more.`
              : ar
              ? `باقتك الحالية تشمل ${planLimit} وحدة + ${sub.addonUnits} وحدة إضافية. أضف المزيد بسعر $${perUnit.toFixed(2)} للوحدة شهرياً — تُستخدم في أي مبنى.`
              : `Your plan includes ${planLimit} units + ${sub.addonUnits} add-ons. Add more at $${perUnit.toFixed(2)}/unit/month — usable across any building.`}
          </DialogDescription>
        </DialogHeader>

        {isFree ? (
          <Button
            onClick={() => {
              onOpenChange(false);
              navigate("/pricing");
            }}
            className="w-full h-12 rounded-xl bg-gradient-sage text-primary-foreground font-bold"
          >
            {ar ? "عرض الخطط" : "View plans"}
          </Button>
        ) : (
          <div className="space-y-2 mt-2">
            {ADDON_OPTIONS.map((qty) => {
              const monthly = (qty * perUnit).toFixed(2);
              return (
                <button
                  key={qty}
                  onClick={() => buy(qty)}
                  disabled={busy !== null}
                  className="w-full flex items-center justify-between rounded-2xl border-2 border-sage-200/50 bg-card p-4 hover:border-sage-400 hover:bg-sage-100/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-sage-100 text-sage-500 grid place-items-center">
                      <Plus className="h-5 w-5" />
                    </div>
                    <div className="text-start">
                      <div className="font-black text-sage-600">
                        {ar ? `${qty} ${qty === 1 ? "وحدة" : "وحدات"}` : `${qty} unit${qty > 1 ? "s" : ""}`}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {ar ? "تُضاف لاشتراكك الشهري" : "added to your monthly plan"}
                      </div>
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="font-black text-sage-600">+${monthly}</div>
                    <div className="text-[10px] text-muted-foreground">{ar ? "/شهر" : "/mo"}</div>
                  </div>
                  {busy === qty && <Loader2 className="h-4 w-4 animate-spin text-sage-500 ms-2" />}
                </button>
              );
            })}
            <button
              onClick={() => {
                onOpenChange(false);
                navigate("/pricing");
              }}
              className="w-full text-xs text-sage-500 hover:text-sage-600 mt-2 underline"
            >
              {ar ? "أو ترقية الباقة" : "Or upgrade your plan"}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
