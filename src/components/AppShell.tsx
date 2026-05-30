import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ActivityNotifier } from "@/components/ActivityNotifier";
import { QuickAddPaymentFab } from "@/components/QuickAddPaymentFab";
import { LifecycleBanner } from "@/components/GraceBanner";

export function AppShell() {
  const [defaultOpen, setDefaultOpen] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setDefaultOpen(window.matchMedia("(min-width: 1024px)").matches);
    }
  }, []);
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <ActivityNotifier />
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
    </SidebarProvider>
  );
}
