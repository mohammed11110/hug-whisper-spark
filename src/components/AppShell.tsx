import { Suspense, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ActivityNotifier } from "@/components/ActivityNotifier";
import { TourLauncher } from "@/components/TourLauncher";
import { QuickAddPaymentFab } from "@/components/QuickAddPaymentFab";
import { LifecycleBanner } from "@/components/GraceBanner";
import { InstallPrompt } from "@/components/InstallPrompt";
import { OfflineBanner } from "@/components/OfflineBanner";

import { useAuth } from "@/lib/auth";
import { enablePushIfNative } from "@/lib/push";

export function AppShell() {
  const { user } = useAuth();
  const location = useLocation();

  const [defaultOpen, setDefaultOpen] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Open the sidebar by default only on true desktop widths so iPad Pro 12.9" portrait (1024) does not overflow.
      setDefaultOpen(window.matchMedia("(min-width: 1280px)").matches);
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
      <TourLauncher />
      <OfflineBanner />
      <LifecycleBanner />
      <div className="flex w-full min-h-svh">
        <div className="hidden md:block">
          <AppSidebar />
        </div>
        <main key={location.pathname} className="flex-1 min-w-0 page-enter">
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </main>

      </div>
      <QuickAddPaymentFab />
      <InstallPrompt />
      
    </SidebarProvider>
  );
}

/**
 * Lightweight fallback shown for the brief moment a lazy route chunk
 * is still being fetched. A thin sage progress bar at the top keeps the
 * shell (sidebar, banners, FAB) visible so navigation feels instant
 * instead of blanking to a full LoadingScreen.
 */
function RouteFallback() {
  return (
    <div className="relative w-full h-1 overflow-hidden bg-sage-50/40">
      <div className="absolute inset-y-0 w-1/3 bg-sage-400/70 animate-[routeBar_1.1s_ease-in-out_infinite]" />
      <style>{`@keyframes routeBar{0%{transform:translateX(-100%)}100%{transform:translateX(400%)}}`}</style>
    </div>
  );
}
