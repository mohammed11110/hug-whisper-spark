import { useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { LANGUAGES, useI18n, type Lang } from "@/lib/i18n";
import { CURRENCIES, useCurrency } from "@/lib/currency";
import { useAuth } from "@/lib/auth";
import { useTheme, type Theme } from "@/lib/theme";
import { LogOut, User as UserIcon, Crown, Sun, Moon, Monitor } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function SettingsPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t, lang, setLang } = useI18n();
  const { currency, setCurrency } = useCurrency();
  const { user, signOut } = useAuth();
  const { theme, setTheme, resolved } = useTheme();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"account" | "language" | "currency">("account");

  const handleSignOut = async () => {
    await signOut();
    onOpenChange(false);
    navigate("/welcome");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-0 bg-background max-w-[430px] mx-auto p-0 max-h-[85vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-sage-200/50 flex-shrink-0">
          <div className="bg-gradient-sage rounded-2xl p-4 text-primary-foreground shadow-soft">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-card/20 backdrop-blur flex items-center justify-center">
                <UserIcon className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{user?.user_metadata?.name || user?.email}</p>
                <p className="text-xs opacity-80 truncate">{user?.email}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleSignOut} className="text-primary-foreground hover:bg-card/10 rounded-full">
                <LogOut className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </div>
          </div>

          <button className="mt-3 w-full bg-muted rounded-xl p-3 flex items-center gap-2.5 hover:bg-sage-100 transition-colors">
            <Crown className="h-4 w-4 text-gold" />
            <span className="text-sm font-semibold text-sage-600 flex-1 text-start">{t("current_plan")}</span>
            <span className="text-xs font-bold text-sage-500 uppercase">{t("free")}</span>
          </button>
        </div>

        <div className="flex border-b border-sage-200/50 flex-shrink-0">
          {(["account", "language", "currency"] as const).map((tk) => (
            <button
              key={tk}
              onClick={() => setTab(tk)}
              className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
                tab === tk ? "border-sage-400 text-sage-600" : "border-transparent text-muted-foreground"
              }`}
            >
              {tk === "account" ? t("settings") : tk === "language" ? t("language") : t("currency")}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          {tab === "language" && (
            <div className="space-y-1.5">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code as Lang)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    l.code === lang ? "bg-gradient-sage text-primary-foreground" : "hover:bg-muted"
                  }`}
                >
                  <span className="text-xl">{l.flag}</span>
                  <span className="font-semibold flex-1 text-start">{l.name}</span>
                  {l.code === lang && <span>✓</span>}
                </button>
              ))}
            </div>
          )}
          {tab === "currency" && (
            <div className="space-y-1">
              {CURRENCIES.map((c) => (
                <button
                  key={c.code}
                  onClick={() => setCurrency(c.code)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${
                    c.code === currency.code ? "bg-gradient-sage text-primary-foreground" : "hover:bg-muted"
                  }`}
                >
                  <span className="font-mono font-bold text-sm w-12 text-start">{c.code}</span>
                  <span className="text-sm flex-1 text-start opacity-80">{c.name}</span>
                  <span className="text-sm font-semibold">{c.symbol}</span>
                </button>
              ))}
            </div>
          )}
          {tab === "account" && (
            <div className="space-y-4 text-sm text-foreground">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {t("appearance") || "Appearance"}
                </p>
                <div className="grid grid-cols-3 gap-2 p-1 bg-muted rounded-xl">
                  {([
                    { v: "light" as Theme, icon: Sun, label: t("light") || "Light" },
                    { v: "dark" as Theme, icon: Moon, label: t("dark") || "Dark" },
                    { v: "system" as Theme, icon: Monitor, label: t("system") || "Auto" },
                  ]).map(({ v, icon: Icon, label }) => (
                    <button
                      key={v}
                      onClick={() => setTheme(v)}
                      className={`flex flex-col items-center gap-1 py-2.5 rounded-lg transition-all ${
                        theme === v
                          ? "bg-card shadow-soft text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-xs font-semibold">{label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {theme === "system"
                    ? `${t("following_system") || "Following system"} · ${resolved}`
                    : ""}
                </p>
              </div>
              <Button variant="outline" className="w-full border-burgundy/30 text-burgundy hover:bg-burgundy/5 rounded-xl" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 me-2 rtl:rotate-180" /> {t("sign_out")}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
