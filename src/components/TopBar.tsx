import { useEffect, useState } from "react";
import { Settings, Search, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { SettingsPanel } from "@/components/SettingsPanel";
import { GlobalSearch } from "@/components/GlobalSearch";
import { useAdmin } from "@/lib/useAdmin";
import { NotificationBell } from "@/components/NotificationBell";
import { HelpMenu } from "@/components/HelpMenu";

export function TopBar({ hasAlerts = false }: { hasAlerts?: boolean }) {
  const { t } = useI18n();
  const [time, setTime] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { isAdmin } = useAdmin();

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
          <div className="flex items-center gap-1 justify-end">
            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9" onClick={() => setSearchOpen(true)} aria-label="بحث">
              <Search className="h-4 w-4 text-sage-500" />
            </Button>
            {isAdmin && (
              <Link to="/admin" aria-label="لوحة المسؤول">
                <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
                  <Shield className="h-4 w-4 text-accent" />
                </Button>
              </Link>
            )}
            <HelpMenu />
            <NotificationBell hasAlerts={hasAlerts} />
            <Link to="/settings">
              <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
                <Settings className="h-4 w-4 text-sage-500" />
              </Button>
            </Link>
          </div>
        </div>
      </header>
      <SettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} />
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
