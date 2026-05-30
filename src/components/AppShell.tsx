import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ActivityNotifier } from "@/components/ActivityNotifier";
import { QuickAddPaymentFab } from "@/components/QuickAddPaymentFab";
import { LifecycleBanner } from "@/components/GraceBanner";
import { InstallPrompt } from "@/components/InstallPrompt";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useAuth } from "@/lib/auth";
import { enablePushIfNative } from "@/lib/push";

export function AppShell() {
  const { user } = useAuth();
  const [defaultOpen, setDefaultOpen] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setDefaultOpen(window.matchMedia("(min-width: 1024px)").matches);
    }
  }, []);
  // Ask for push permission ~6s after login, not on first launch.
  useEffect(() => {
    if (!user?.id) return;
    const t = setTimeout(() => { enablePushIfNative(user.id); }, 6000);
    return () => clearTimeout(t);
  }, [user?.id]);
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <ActivityNotifier />
      <OfflineBanner />
      <LifecycleBanner />
      <div className="flex w-full min-h-svh">
        <div className="hidden md:block">
          <AppSidebar />
        </div>
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
      <QuickAddPaymentFab />
      <InstallPrompt />
    </SidebarProvider>
  );
}
