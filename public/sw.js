/**
 * Kill-switch service worker.
 *
 * Replaces the previous Workbox/vite-plugin-pwa worker that was caching old
 * hashed assets and forcing users to fully close the browser to recover.
 *
 * What it does on activation:
 *   1. Deletes only this app's Workbox caches (origin-scoped — leaves
 *      Firebase Messaging / OneSignal caches alone if any).
 *   2. Claims existing window clients and reloads them so they land on the
 *      fresh network HTML.
 *   3. Unregisters itself so the browser stops running any service worker
 *      for this origin.
 */
function isWorkboxCacheForThisRegistration(name) {
  const hasWorkboxBucket =
    /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)amlaki-|(^|-)google-fonts-/.test(name);
  return hasWorkboxBucket && name.endsWith(self.registration.scope);
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        const workboxCacheNames = cacheNames.filter(isWorkboxCacheForThisRegistration);
        await Promise.allSettled(workboxCacheNames.map((name) => caches.delete(name)));
        await self.clients.claim();
        const windowClients = await self.clients.matchAll({ type: "window" });
        await Promise.allSettled(
          windowClients.map((client) => client.navigate(client.url)),
        );
      } finally {
        await self.registration.unregister();
      }
    })(),
  ),
);

// Pass through all fetches untouched — no caching.
self.addEventListener("fetch", () => {});
