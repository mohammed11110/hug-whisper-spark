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
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return;
    await supabase.from("activity_log").insert({
      user_id: uid,
      building_id: input.buildingId ?? null,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      entity_label: input.entityLabel ?? null,
      action: input.action,
      description_ar: input.descriptionAr ?? null,
      description_en: input.descriptionEn ?? null,
      changes: input.changes ?? {},
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
