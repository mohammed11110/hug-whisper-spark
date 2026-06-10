/**
 * Resume / reconnect re-fetch driver.
 *
 * Single source-of-truth model: when the app comes back to the foreground
 * (Capacitor native or browser visibilitychange) or the network reconnects,
 * we invalidate every active react-query so each screen pulls fresh data
 * from the server. Realtime is just a nice-to-have on top.
 */
import { useEffect } from "react";
import { queryClient } from "@/lib/queryClient";

export function AppResumeSync() {
  useEffect(() => {
    const refetchAll = () => {
      try { queryClient.invalidateQueries(); } catch { /* noop */ }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") refetchAll();
    };
    const onOnline = () => refetchAll();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);

    let removeCapListener: (() => void) | null = null;
    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const handle = await App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) refetchAll();
        });
        removeCapListener = () => { try { handle.remove(); } catch { /* noop */ } };
      } catch { /* not in a native shell */ }
    })();

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      if (removeCapListener) removeCapListener();
    };
  }, []);

  return null;
}
