import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSubscription, NEXT_TIER, PLAN_UNIT_LIMITS, type PlanTier } from "@/hooks/useSubscription";

const NAMES_AR: Record<PlanTier, string> = {
  free: "المجاني",
  personal: "الشخصي",
  pro: "الاحترافي",
  business: "الأعمال",
  enterprise: "المؤسسات",
};
const NAMES_EN: Record<PlanTier, string> = {
  free: "Free",
  personal: "Personal",
  pro: "Professional",
  business: "Business",
  enterprise: "Enterprise",
};

/**
 * Shown when a user hits their plan's unit cap.
 * Replaces the old per-unit add-on flow — now just nudges to the next tier.
 */
export function BuyAddonUnitsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPurchased?: () => void;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const navigate = useNavigate();
  const sub = useSubscription();

  const plan = sub.plan as PlanTier;
  const planLimit = PLAN_UNIT_LIMITS[plan] ?? PLAN_UNIT_LIMITS.free;
  const next = NEXT_TIER[plan];
  const nextLimit = next ? PLAN_UNIT_LIMITS[next] : null;
  const nextName = next ? (ar ? NAMES_AR[next] : NAMES_EN[next]) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-black text-foreground text-xl flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-gold" />
            {ar ? "وصلت إلى حد الباقة" : "You've reached your plan limit"}
          </DialogTitle>
          <DialogDescription className="text-sm leading-6">
            {next
              ? ar
                ? `باقتك الحالية (${NAMES_AR[plan]}) تتيح ${planLimit} وحدة. رقّ إلى ${nextName} للحصول على حتى ${nextLimit} وحدة وميزات إضافية.`
                : `Your current ${NAMES_EN[plan]} plan allows ${planLimit} units. Upgrade to ${nextName} for up to ${nextLimit} units and more features.`
              : ar
              ? "أنت على أعلى باقة متاحة. تواصل معنا لاحتياجات أكبر."
              : "You're already on the top plan. Contact us for larger needs."}
          </DialogDescription>
        </DialogHeader>

        <Button
          onClick={() => {
            onOpenChange(false);
            navigate("/pricing");
          }}
          className="w-full h-12 rounded-xl bg-gold hover:bg-gold/90 text-primary-foreground font-bold flex items-center justify-center gap-2"
        >
          <ArrowUpRight className="h-4 w-4 rtl:rotate-180" />
          {ar ? "عرض الخطط" : "View plans"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
