import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

/**
 * Global subscriber to the activity_log table. Shows a toast whenever another
 * member of any shared building performs an action. Silent for the current
 * user's own actions to avoid noise. RLS already scopes inserts the user can
 * see, so we just need to filter out self.
 */
export function ActivityNotifier() {
  const { user } = useAuth();
  const { lang } = useI18n();

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`activity_log_global:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_log" },
        (payload) => {
          const row: any = payload.new;
          if (!row || row.user_id === user.id) return;
          const desc =
            (lang === "ar" ? row.description_ar : row.description_en) ||
            row.entity_label ||
            row.entity_type;
          toast(desc, {
            description: lang === "ar" ? "نشاط جديد على حسابك" : "New activity on your account",
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, lang]);

  return null;
}
