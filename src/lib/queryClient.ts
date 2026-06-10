import { QueryClient } from "@tanstack/react-query";

/**
 * Server-is-source-of-truth defaults:
 * - Refetch on tab focus and on network reconnect.
 * - Short staleTime so opening a screen re-pulls fresh data.
 * - Retry transient failures (network/5xx) but not permission errors.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      staleTime: 15_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, err: any) => {
        const msg = String(err?.message || err || "").toLowerCase();
        if (
          msg.includes("permission") ||
          msg.includes("denied") ||
          msg.includes("not authorized") ||
          msg.includes("401") ||
          msg.includes("403") ||
          msg.includes("rls")
        ) return false;
        return failureCount < 2;
      },
    },
    mutations: { retry: 0 },
  },
});
