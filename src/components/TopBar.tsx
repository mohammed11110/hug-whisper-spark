import { useEffect, useState } from "react";
import { Settings, Bell } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { SettingsPanel } from "@/components/SettingsPanel";

export function TopBar({ hasAlerts = false }: { hasAlerts?: boolean }) {
  const { t } = useI18n();
  const [time, setTime] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const update = () => {
      const d = new Date();
      setTime(d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 glass border-b border-sage-200/40">
        <div className="flex items-center justify-between px-4 h-14">
          <span className="text-xs font-mono text-muted-foreground w-12">{time}</span>
          <div className="flex items-center gap-2">
            <Logo size={28} />
            <span className="font-black text-sage-600 text-lg tracking-tight">{t("app_name")}</span>
          </div>
          <div className="flex items-center gap-1 w-12 justify-end">
            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 relative">
              <Bell className="h-4 w-4 text-sage-500" />
              {hasAlerts && <span className="absolute top-1.5 end-1.5 h-2 w-2 bg-burgundy rounded-full animate-pulse-soft" />}
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9" onClick={() => setSettingsOpen(true)}>
              <Settings className="h-4 w-4 text-sage-500" />
            </Button>
          </div>
        </div>
      </header>
      <SettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
