import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Users,
  Wallet,
  CalendarCheck,
  BarChart3,
  Bell,
  Sparkles,
  Settings as SettingsIcon,
  HardDriveDownload,
  UsersRound,
  Wrench,
  Activity as ActivityIcon,
  CalendarRange,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/Logo";
import { useI18n } from "@/lib/i18n";
import { useT2 } from "@/lib/i18n2";

export function AppSidebar() {
  const { t, rtl } = useI18n();
  const t2 = useT2();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const isActive = (p: string) => (p === "/" ? pathname === "/" : pathname.startsWith(p));

  const main = [
    { to: "/", label: t("dashboard"), icon: LayoutDashboard, end: true },
    { to: "/buildings", label: t("buildings"), icon: Building2 },
    { to: "/tenants", label: t("tenants"), icon: Users },
    { to: "/payments", label: t("payments"), icon: Wallet },
    { to: "/collection", label: t2("monthly_collection"), icon: CalendarCheck },
    { to: "/daily", label: "الإيجارات اليومية", icon: CalendarRange },
  ];
  const tools = [
    { to: "/reports", label: t("reports"), icon: BarChart3 },
    { to: "/maintenance", label: t2("maintenance_requests"), icon: Wrench },
    { to: "/notifications", label: t("notifications"), icon: Bell },
    { to: "/activity", label: t2("activity_log"), icon: ActivityIcon },
    { to: "/assistant", label: "AI", icon: Sparkles },
  ];
  const manage = [
    { to: "/team", label: "Team", icon: UsersRound },
    { to: "/backup", label: "Backup", icon: HardDriveDownload },
    { to: "/settings", label: t("settings"), icon: SettingsIcon },
  ];

  return (
    <Sidebar side={rtl ? "right" : "left"} collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <Logo size={28} />
          {!collapsed && (
            <span className="font-black text-sage-600 text-lg tracking-tight">
              {t("app_name")}
            </span>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {[
          { label: t("dashboard"), items: main },
          { label: t("reports"), items: tools },
          { label: t("settings"), items: manage },
        ].map((group, i) => (
          <SidebarGroup key={i}>
            {!collapsed && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={isActive(item.to)} tooltip={item.label}>
                      <NavLink to={item.to} end={(item as any).end}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
