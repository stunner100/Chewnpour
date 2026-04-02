self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const cacheKeys = await caches.keys();
      await Promise.allSettled(cacheKeys.map((key) => caches.delete(key)));
    } catch {
      // Ignore cache cleanup failures during the PWA cutover.
    }

    try {
      await self.registration.unregister();
    } catch {
      // Ignore unregister failures; the client boot path also clears workers.
    }

    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    await Promise.allSettled(
      clients.map((client) => client.navigate(client.url))
    );
  })());
});

self.addEventListener('fetch', () => {
  // Intentionally empty. This worker exists only to unregister older PWAs.
});
