import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

interface Notif {
  id: string;
  kind: string;
  title_ar: string;
  title_en: string | null;
  body_ar: string;
  body_en: string | null;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
}

export function NotificationBell({ hasAlerts = false }: { hasAlerts?: boolean }) {
  const { user } = useAuth();
  const { lang } = useI18n();
  const ar = lang === "ar";
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("in_app_notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setItems((data ?? []) as Notif[]);
  };

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel(`notif:${user.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "in_app_notifications", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const unread = items.filter((n) => !n.read_at).length;
  const showDot = unread > 0 || hasAlerts;

  const onOpenChange = async (v: boolean) => {
    setOpen(v);
    if (v && unread > 0 && user) {
      await supabase
        .from("in_app_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .is("read_at", null);
      load();
    }
  };

  const handleClick = (n: Notif) => {
    setOpen(false);
    if (n.action_url) navigate(n.action_url);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 relative" aria-label="Notifications">
          <Bell className="h-4 w-4 text-sage-500" />
          {showDot && (
            <span className="absolute top-1.5 end-1.5 min-w-[18px] h-[18px] px-1 bg-burgundy text-white rounded-full text-[10px] font-bold flex items-center justify-center">
              {unread > 0 ? (unread > 9 ? "9+" : unread) : ""}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-sage-200/40">
          <p className="font-bold text-sage-600 text-sm">{ar ? "الإشعارات" : "Notifications"}</p>
        </div>
        <ScrollArea className="max-h-[400px]">
          {items.length === 0 ? (
            <p className="text-center text-xs text-sage-400 py-8">
              {ar ? "لا توجد إشعارات" : "No notifications yet"}
            </p>
          ) : (
            <ul className="divide-y divide-sage-100">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => handleClick(n)}
                    className={`w-full text-start px-4 py-3 hover:bg-sage-50 transition-colors ${!n.read_at ? "bg-sage-50/50" : ""}`}
                  >
                    <p className="font-bold text-sage-600 text-xs">{ar ? n.title_ar : (n.title_en ?? n.title_ar)}</p>
                    <p className="text-[11px] text-sage-500 mt-1 leading-relaxed">
                      {ar ? n.body_ar : (n.body_en ?? n.body_ar)}
                    </p>
                    <p className="text-[10px] text-sage-400 mt-1">
                      {new Date(n.created_at).toLocaleString(ar ? "ar" : "en", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
