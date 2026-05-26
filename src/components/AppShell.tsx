import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ActivityNotifier } from "@/components/ActivityNotifier";
import { QuickAddPaymentFab } from "@/components/QuickAddPaymentFab";

/**
 * Layout shell: on iPad/desktop (md+) shows a collapsible sidebar next to the
 * page content. On phones it renders nothing extra — pages keep their existing
 * TopBar + BottomNav experience untouched.
 */
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

