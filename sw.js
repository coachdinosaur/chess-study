/**
 * CD Digital Chess Study - Service Worker Clean-up & Retirement
 * Automatically unregisters active service workers and purges legacy caches
 * to allow native Fastly CDN streaming and ensure 3D Chess, Openings, and
 * SPA pages load reliably without worker interference.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.claim())
  );
});
