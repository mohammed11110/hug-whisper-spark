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
  enterprise: Infinity,
};

export const ADDON_UNIT_PRICE: Record<PlanTier, number> = {
  free: 0,
  personal: 0.99,
  pro: 0.69,
  business: 0.49,
  enterprise: 0,
};

const PRODUCT_TO_PLAN: Record<string, PlanTier> = {
  amlaki_starter: "personal",
  amlaki_personal: "personal",
  amlaki_pro: "pro",
  amlaki_business: "business",
  amlaki_enterprise: "enterprise",
};

export type AccountPhase =
  | "trial"
  | "active"
  | "readonly_grace"
  | "subscription_grace"
  | "deleted"
  | "free";

export interface SubscriptionState {
  loading: boolean;
  plan: PlanTier;
  status: string;
  isActive: boolean;
  isTrialing: boolean;
  trialEndsAt: Date | null;
  trialDaysLeft: number | null;
  graceEndsAt: Date | null;
  graceDaysLeft: number | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  paddleSubscriptionId: string | null;
  unitLimit: number;
  addonUnits: number;
  phase: AccountPhase;
  canceledAt: Date | null;
  dataDeleteAt: Date | null;
  isReadOnly: boolean;
  canExport: boolean;
  refresh: () => Promise<void>;
}

const DEFAULT: Omit<SubscriptionState, "refresh"> = {
  loading: true,
  plan: "free",
  status: "trial",
  isActive: false,
  isTrialing: false,
  trialEndsAt: null,
  trialDaysLeft: null,
  graceEndsAt: null,
  graceDaysLeft: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  paddleSubscriptionId: null,
  unitLimit: Infinity,
  addonUnits: 0,
  phase: "free",
  canceledAt: null,
  dataDeleteAt: null,
  isReadOnly: false,
  canExport: true,
};

export function useSubscription(): SubscriptionState {
  const { user } = useAuth();
  const [state, setState] = useState<Omit<SubscriptionState, "refresh">>(DEFAULT);

  const load = useCallback(async () => {
    if (!user) {
      setState({ ...DEFAULT, loading: false });
      return;
    }
    const env = getPaddleEnvironment();
    const [subRes, profileRes, phaseRes] = await Promise.all([
      supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("environment", env)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("trial_ends_at, grace_ends_at")
        .eq("id", user.id)
        .maybeSingle(),
      supabase.rpc("account_phase", { _user_id: user.id }),
    ]);

    const sub = subRes.data;
    const profile = profileRes.data as { trial_ends_at: string | null; grace_ends_at: string | null } | null;
    const phase = ((phaseRes.data as string) ?? "free") as AccountPhase;

    const now = Date.now();
    const trialEndsAt = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
    const graceEndsAt = profile?.grace_ends_at ? new Date(profile.grace_ends_at) : null;
    const trialDaysLeft = trialEndsAt
      ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now) / 86_400_000))
      : null;
    const graceDaysLeft = graceEndsAt
      ? Math.max(0, Math.ceil((graceEndsAt.getTime() - now) / 86_400_000))
      : null;

    const plan: PlanTier = sub ? PRODUCT_TO_PLAN[sub.product_id as string] ?? "free" : "free";
    const status = (sub?.status as string) ?? (phase === "trial" ? "trial" : "free");
    const currentPeriodEnd = sub?.current_period_end ? new Date(sub.current_period_end as string) : null;
    const canceledAt = sub && (sub as any).canceled_at ? new Date((sub as any).canceled_at) : null;
    const dataDeleteAt = sub && (sub as any).data_delete_at ? new Date((sub as any).data_delete_at) : null;

    const isActive = phase === "active" || phase === "trial";
    const isReadOnly = phase === "readonly_grace" || phase === "subscription_grace";

    setState({
      loading: false,
      plan: isActive ? plan : "free",
      status,
      isActive,
      isTrialing: phase === "trial",
      trialEndsAt,
      trialDaysLeft,
      graceEndsAt,
      graceDaysLeft,
      currentPeriodEnd,
      cancelAtPeriodEnd: !!sub?.cancel_at_period_end,
      paddleSubscriptionId: (sub?.paddle_subscription_id as string) ?? null,
      addonUnits: Number((sub as any)?.addon_units ?? 0),
      // Trial gets unlimited (Infinity); active paid gets plan+addons; otherwise free tier.
      unitLimit: phase === "trial"
        ? Infinity
        : phase === "active"
          ? PLAN_UNIT_LIMITS[plan] + Number((sub as any)?.addon_units ?? 0)
          : PLAN_UNIT_LIMITS.free,
      phase,
      canceledAt,
      dataDeleteAt,
      isReadOnly,
      canExport: phase !== "deleted",
    });
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`subs:${user.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, load]);

  return { ...state, refresh: load };
}

export function useUnitUsage() {
  const { user } = useAuth();
  const [unitCount, setUnitCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setUnitCount(0); setLoading(false); return; }
    const { data: buildings } = await supabase.from("buildings").select("id").eq("user_id", user.id);
    const ids = (buildings ?? []).map((b) => b.id);
    if (ids.length === 0) { setUnitCount(0); setLoading(false); return; }
    const { count } = await supabase.from("units").select("id", { count: "exact", head: true }).in("building_id", ids);
    setUnitCount(count ?? 0);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  return { unitCount, loading, refresh };
}
