/**
 * Page-level hook: re-runs `refetch` whenever any of the given tables
 * changes (via the global RealtimeSync channel), and also whenever the
 * tab becomes visible again or window regains focus — covering iOS
 * background suspension where Realtime can briefly disconnect.
 */
import { useEffect, useRef } from "react";
import { SYNC_EVENT, type SyncEventDetail } from "@/lib/realtimeSync";

export function useLiveData(
  tables: string[],
  refetch: () => void | Promise<void>,
  opts: { debounceMs?: number } = {},
) {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  const tablesKey = tables.join("|");

  useEffect(() => {
    const debounceMs = opts.debounceMs ?? 250;
    const watched = new Set(tablesKey.split("|").filter(Boolean));
    let timer: ReturnType<typeof setTimeout> | null = null;

    const trigger = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        try { void refetchRef.current(); } catch { /* noop */ }
      }, debounceMs);
    };

    const onSync = (e: Event) => {
      const detail = (e as CustomEvent<SyncEventDetail>).detail;
      if (!detail) return;
      if (watched.has(detail.table)) trigger();
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") trigger();
    };
    const onFocus = () => { trigger(); };

    window.addEventListener(SYNC_EVENT, onSync);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(SYNC_EVENT, onSync);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [tablesKey, opts.debounceMs]);
}
