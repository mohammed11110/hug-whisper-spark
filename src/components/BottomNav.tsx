import { NavLink, useLocation } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useT2 } from "@/lib/i18n2";
import { navPrefetchHandlers } from "@/lib/routePrefetch";

const tabs = [
  { to: "/", label: "dashboard", icon: "◐", t2: false },
  { to: "/buildings", label: "buildings", icon: "⌬", t2: false },
  { to: "/tenants", label: "tenants", icon: "◉", t2: false },
  { to: "/payments", label: "payments", icon: "◈", t2: false },
  { to: "/reports", label: "reports", icon: "▦", t2: false },
];

/** Routes that should NOT render the bottom nav (full-screen / unauth pages). */
const HIDDEN_ROUTES = ["/auth", "/welcome", "/forgot-password", "/reset-password", "/p/", "/install"];

export function BottomNav() {
  const { t } = useI18n();
  const t2 = useT2();
  const { pathname } = useLocation();
  if (HIDDEN_ROUTES.some((p) => pathname.startsWith(p))) return null;

  return (
    <nav
      className="fixed left-0 right-0 bottom-0 z-50 md:hidden pointer-events-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto max-w-[430px] pointer-events-auto">
        <div
          className="glass border-t px-2 pt-2 pb-2"
          style={{ borderColor: "rgba(202,168,105,0.18)" }}
        >
          <ul className="flex justify-around items-center">
            {tabs.map((tab) => (
              <li key={tab.to} className="flex-1">
                <NavLink
                  to={tab.to}
                  end={tab.to === "/"}
                  {...navPrefetchHandlers(tab.to)}
                  className={({ isActive }) =>
                    `relative flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all duration-200 ease-out ${
                      isActive ? "text-primary" : "text-muted-foreground"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={`text-2xl leading-none transition-transform duration-200 ease-out ${
                          isActive ? "scale-110 -translate-y-0.5" : ""
                        }`}
                        style={isActive ? { filter: "drop-shadow(0 0 8px rgba(202,168,105,0.45))" } : undefined}
                      >
                        {tab.icon}
                      </span>
                      <span className="text-[10px] font-semibold">{tab.t2 ? t2(tab.label as any) : t(tab.label)}</span>
                      <span className="nav-active-indicator" data-active={isActive ? "true" : "false"} />
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}
