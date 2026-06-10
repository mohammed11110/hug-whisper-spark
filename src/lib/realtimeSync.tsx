/**
 * Global cross-device data sync.
 *
 * Mounts a single Supabase Realtime channel for the signed-in user and
 * listens for INSERT / UPDATE / DELETE on all of the account's tables.
 * On every event it:
 *   1) invalidates react-query caches for the matching keys, and
 *   2) re-emits the legacy `paymentsBus` for `payments` changes, and
 *   3) dispatches a window CustomEvent `amlaki:data-changed` carrying
 *      `{ table, eventType }`.
 *
 * Pages opt in by calling `useLiveData([...tables], refetch)` — they
 * keep their existing fetch logic and just get re-run whenever a
 * relevant change arrives (from any device).
 */
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { queryClient } from "@/lib/queryClient";
import { paymentsBus } from "@/lib/paymentsBus";
import { signatureBus } from "@/lib/signature";


export const SYNC_EVENT = "amlaki:data-changed" as const;

export interface SyncEventDetail {
  table: string;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  // Best-effort row payload; pages should not rely on shape.
  new?: Record<string, unknown> | null;
  old?: Record<string, unknown> | null;
}

const SYNCED_TABLES: readonly string[] = [
  // Core property data
  "buildings", "units", "tenancies", "payments", "expenses", "maintenance_requests",
  // Account / settings / notifications
  "profiles", "receipt_counters", "in_app_notifications", "activity_log",
  // Team
  "building_members", "invitations", "unit_audit_log",
  // Daily rental
  "daily_bookings", "daily_units", "daily_cleaning_tasks", "daily_pricing_rules",
  "daily_message_templates", "daily_cleaners",
];

/** Map a table name to the react-query keys it influences. */
function invalidateForTable(table: string) {
  const keys: string[][] = [[table]];
  if (table === "payments") keys.push(["units"]);
  if (table === "tenancies") keys.push(["units"]);
  if (table === "expenses") keys.push(["units"]);
  if (table === "maintenance_requests") keys.push(["units"]);
  for (const k of keys) {
    try { queryClient.invalidateQueries({ queryKey: k }); } catch { /* noop */ }
  }
}

export function RealtimeSync() {
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let currentUid: string | null = null;

    const teardown = () => {
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* noop */ }
        channel = null;
      }
      currentUid = null;
    };

    const setup = async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (!uid) { teardown(); return; }
      if (uid === currentUid && channel) return; // already subscribed
      teardown();
      currentUid = uid;

      const ch = supabase.channel(`amlaki-sync-${uid}`);
      for (const t of SYNCED_TABLES) {
        ch.on(
          "postgres_changes" as any,
          { event: "*", schema: "public", table: t },
          (payload: any) => {
            const eventType: SyncEventDetail["eventType"] =
              (payload?.eventType || payload?.event || "UPDATE").toUpperCase();
            invalidateForTable(t);
            if (t === "payments") {
              try {
                const unitId =
                  payload?.new?.unit_id ?? payload?.old?.unit_id ?? null;
                paymentsBus.emit(unitId);
              } catch { /* noop */ }
            }
            // Cross-device signature sync: when our own profile row changes,
            // signal the signature UI to re-read from cache/server via React Query.
            if (t === "profiles") {
              try {
                const newId = (payload?.new as any)?.id ?? (payload?.old as any)?.id ?? null;
                if (!newId || newId === uid) signatureBus.emit();
              } catch { /* noop */ }
            }
            try {
              window.dispatchEvent(new CustomEvent<SyncEventDetail>(SYNC_EVENT, {
                detail: {
                  table: t,
                  eventType,
                  new: payload?.new ?? null,
                  old: payload?.old ?? null,
                },
              }));
            } catch { /* noop */ }

          },
        );
      }
      ch.subscribe();
      channel = ch;
    };


    void setup();
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (session?.user) void setup();
      else teardown();
    });

    return () => {
      sub.subscription.unsubscribe();
      teardown();
    };
  }, []);

  return null;
}
