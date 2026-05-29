import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getPaddleEnvironment } from "@/lib/paddle";

export type PlanTier = "free" | "personal" | "pro" | "business" | "enterprise";

// Unit limits per plan (matches public.get_plan_unit_limit)
export const PLAN_UNIT_LIMITS: Record<PlanTier, number> = {
  free: 3,
  personal: 10,
  pro: 25,
  business: 75,
  enterprise: Infinity, // legacy grandfathered plan
};

// Add-on monthly price per unit (USD) per plan
export const ADDON_UNIT_PRICE: Record<PlanTier, number> = {
  free: 0,
  personal: 0.99,
  pro: 0.69,
  business: 0.49,
  enterprise: 0,
};

const PRODUCT_TO_PLAN: Record<string, PlanTier> = {
  amlaki_starter: "personal", // legacy product, now Personal
  amlaki_personal: "personal",
  amlaki_pro: "pro",
  amlaki_business: "business",
  amlaki_enterprise: "enterprise",
};

export interface SubscriptionState {
  loading: boolean;
  plan: PlanTier;
  status: string;
  isActive: boolean;
  isTrialing: boolean;
  trialEndsAt: Date | null;
  trialDaysLeft: number | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  paddleSubscriptionId: string | null;
  unitLimit: number;
  addonUnits: number;
  refresh: () => Promise<void>;
}

export function useSubscription(): SubscriptionState {
  const { user } = useAuth();
  const [state, setState] = useState<Omit<SubscriptionState, "refresh">>({
    loading: true,
    plan: "free",
    status: "inactive",
    isActive: false,
    isTrialing: false,
    trialEndsAt: null,
    trialDaysLeft: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    paddleSubscriptionId: null,
    unitLimit: PLAN_UNIT_LIMITS.free,
    addonUnits: 0,
  });

  const load = useCallback(async () => {
    if (!user) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    const env = getPaddleEnvironment();
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .eq("environment", env)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) {
      setState({
        loading: false,
        plan: "free",
        status: "inactive",
        isActive: false,
        isTrialing: false,
        trialEndsAt: null,
        trialDaysLeft: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        paddleSubscriptionId: null,
        unitLimit: PLAN_UNIT_LIMITS.free,
        addonUnits: 0,
      });
      return;
    }

    const plan: PlanTier = PRODUCT_TO_PLAN[data.product_id as string] ?? "free";
    const status = data.status as string;
    const trialEndsAt = data.trial_ends_at ? new Date(data.trial_ends_at as string) : null;
    const currentPeriodEnd = data.current_period_end
      ? new Date(data.current_period_end as string)
      : null;
    const now = Date.now();
    const isTrialing = status === "trialing" && (!trialEndsAt || trialEndsAt.getTime() > now);
    const isActive =
      (status === "active" || status === "trialing" || status === "past_due") &&
      (!currentPeriodEnd || currentPeriodEnd.getTime() > now) ||
      (status === "canceled" && currentPeriodEnd !== null && currentPeriodEnd.getTime() > now);

    const trialDaysLeft = trialEndsAt
      ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now) / 86_400_000))
      : null;

    setState({
      loading: false,
      plan: isActive ? plan : "free",
      status,
      isActive,
      isTrialing,
      trialEndsAt,
      trialDaysLeft,
      currentPeriodEnd,
      cancelAtPeriodEnd: !!data.cancel_at_period_end,
      paddleSubscriptionId: (data.paddle_subscription_id as string) ?? null,
      addonUnits: Number((data as any).addon_units ?? 0),
      unitLimit:
        PLAN_UNIT_LIMITS[isActive ? plan : "free"] +
        (isActive ? Number((data as any).addon_units ?? 0) : 0),
    });
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: refresh on any change to this user's subscription rows
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`subs:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  return { ...state, refresh: load };
}

export function useUnitUsage() {
  const { user } = useAuth();
  const [unitCount, setUnitCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setUnitCount(0);
      setLoading(false);
      return;
    }
    // Count units in buildings owned by the user
    const { data: buildings } = await supabase
      .from("buildings")
      .select("id")
      .eq("user_id", user.id);
    const ids = (buildings ?? []).map((b) => b.id);
    if (ids.length === 0) {
      setUnitCount(0);
      setLoading(false);
      return;
    }
    const { count } = await supabase
      .from("units")
      .select("id", { count: "exact", head: true })
      .in("building_id", ids);
    setUnitCount(count ?? 0);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { unitCount, loading, refresh };
}
