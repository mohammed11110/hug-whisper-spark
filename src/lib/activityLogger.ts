import { supabase } from "@/integrations/supabase/client";

export type ActivityAction = "created" | "updated" | "deleted" | "restored" | "paid" | "ended";
export type ActivityEntity =
  | "building"
  | "unit"
  | "tenant"
  | "payment"
  | "expense"
  | "maintenance"
  | "settings";

export interface LogActivityInput {
  entityType: ActivityEntity;
  action: ActivityAction;
  entityId?: string | null;
  entityLabel?: string | null;
  buildingId?: string | null;
  descriptionAr?: string;
  descriptionEn?: string;
  changes?: Record<string, any>;
}

/**
 * Best-effort activity logger. Never throws — silently swallows errors so it
 * cannot break the calling write operation.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    // Route through a SECURITY DEFINER RPC so users can't forge audit-log
    // entries (e.g. fake actions or arbitrary descriptions for buildings
    // they don't own). The function validates building access server-side.
    await supabase.rpc("log_activity", {
      _action: input.action,
      _entity_type: input.entityType,
      _entity_id: input.entityId ?? null,
      _building_id: input.buildingId ?? null,
      _description_ar: input.descriptionAr ?? null,
      _description_en: input.descriptionEn ?? null,
      _changes: (input.changes ?? {}) as any,
      _entity_label: input.entityLabel ?? null,
    });
  } catch {
    /* ignore */
  }
}


/** Format ISO timestamp into `DD MMM YYYY - HH:MM:SS` localized. */
export function formatActivityTime(iso: string, lang: "ar" | "en" | string = "ar"): string {
  const d = new Date(iso);
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  const date = d.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return `${date} — ${time}`;
}
