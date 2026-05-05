import { NavLink } from "react-router-dom";
import { useI18n } from "@/lib/i18n";

const tabs = [
  { to: "/", label: "dashboard", icon: "◐" },
  { to: "/buildings", label: "buildings", icon: "⌬" },
  { to: "/notifications", label: "notifications", icon: "◉" },
  { to: "/payments", label: "payments", icon: "◈" },
  { to: "/reports", label: "reports", icon: "◫" },
];

export function BottomNav() {
  const { t } = useI18n();
  return (
    <nav className="fixed bottom-0 inset-x-0 mx-auto max-w-[430px] z-40">
      <div className="glass border-t border-sage-200/60 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <ul className="flex justify-around items-center">
          {tabs.map((tab) => (
            <li key={tab.to} className="flex-1">
              <NavLink
                to={tab.to}
                end={tab.to === "/"}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all ${
                    isActive ? "text-sage-600" : "text-muted-foreground"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`text-2xl leading-none transition-transform ${isActive ? "scale-110" : ""}`}>{tab.icon}</span>
                    <span className="text-[10px] font-semibold">{t(tab.label)}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
