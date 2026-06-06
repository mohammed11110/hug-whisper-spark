/**
 * Prefetch helpers for route-level code-splitting.
 *
 * Each entry maps a URL prefix to a function that imports the page's
 * lazy chunk. We attach these to navigation links via onMouseEnter /
 * onTouchStart / onFocus so the chunk is already in the browser cache
 * by the time the user clicks — eliminating the brief "freeze" that
 * happens when React Suspense is still fetching the JS.
 *
 * Adding a new lazy page? Add it here too. It's cheap — `import()` is
 * cached after the first call, so calling these repeatedly is a no-op.
 */
type Importer = () => Promise<unknown>;

const prefetchers: Record<string, Importer> = {
  "/": () => import("@/pages/Dashboard"),
  "/buildings": () => import("@/pages/Buildings"),
  "/tenants": () => import("@/pages/Tenants"),
  "/payments": () => import("@/pages/Payments"),
  "/reports": () => import("@/pages/Reports"),
  "/maintenance": () => import("@/pages/Maintenance"),
  "/notifications": () => import("@/pages/Notifications"),
  "/assistant": () => import("@/pages/Assistant"),
  "/activity": () => import("@/pages/Activity"),
  "/team": () => import("@/pages/Team"),
  "/backup": () => import("@/pages/Backup"),
  "/settings": () => import("@/pages/Settings"),
  "/daily": () => import("@/pages/daily/DailyLayout"),
};

const seen = new Set<string>();

/** Prefetch the chunk for a given route path. Safe to call many times. */
export function prefetchRoute(path: string): void {
  // Find the most-specific prefix match.
  let match: string | null = null;
  for (const key of Object.keys(prefetchers)) {
    if (key === "/" ? path === "/" : path.startsWith(key)) {
      if (!match || key.length > match.length) match = key;
    }
  }
  if (!match || seen.has(match)) return;
  seen.add(match);
  // Defer one tick so we don't compete with the current paint.
  setTimeout(() => {
    try { void prefetchers[match!](); } catch { /* noop */ }
  }, 0);
}

/** Hover/touch/focus handler bundle for NavLink-like components. */
export const navPrefetchHandlers = (to: string) => ({
  onMouseEnter: () => prefetchRoute(to),
  onTouchStart: () => prefetchRoute(to),
  onFocus: () => prefetchRoute(to),
});
