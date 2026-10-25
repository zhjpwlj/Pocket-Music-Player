import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { clientsClaim } from 'workbox-core';

clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

const formatBridgeInFlight = new Set();

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open('format-bridge');
    for (const req of await cache.keys()) {
      if (req.url.endsWith('?pending')) await cache.delete(req);
    }
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
    return;
  }
  if (event.data?.type === 'PRECACHE_FORMAT_BRIDGE') {
    event.waitUntil(precacheFormatBridge(event.source));
  }
});

async function precacheFormatBridge(client) {
  const cache = await caches.open('format-bridge');
  const assets = [
    '/assets/wasm/ffmpeg-audio.wasm',
    '/assets/wasm/ffmpeg-audio.worker.js',
  ];
  for (const url of assets) {
    if (await cache.match(url)) {
      client?.postMessage({ type: 'FORMAT_BRIDGE_PROGRESS', url, done: true });
      continue;
    }
    if (formatBridgeInFlight.has(url)) continue;
    formatBridgeInFlight.add(url);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.blob();
      const tmpKey = url + '?pending';
      await cache.put(tmpKey, new Response(body, { headers: res.headers }));
      await cache.put(url, new Response(body, { headers: res.headers }));
      await cache.delete(tmpKey);
      client?.postMessage({ type: 'FORMAT_BRIDGE_PROGRESS', url, done: true });
    } catch (err) {
      console.warn('[sw] format-bridge precache failed:', url, err);
      client?.postMessage({
        type: 'FORMAT_BRIDGE_PROGRESS', url, done: false, error: String(err),
      });
    } finally {
      formatBridgeInFlight.delete(url);
    }
  }
}

registerRoute(
  ({ url }) => url.pathname.startsWith('/assets/themes/'),
  new StaleWhileRevalidate({ cacheName: 'themes' })
);
registerRoute(
  ({ url }) => url.pathname.startsWith('/assets/wasm/'),
  new CacheFirst({ cacheName: 'format-bridge' })
);
// Serve the precached shell for navigations. The previous CacheFirst
// 'app-shell' route never populated, so offline reload failed.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// NOTE: no media-cache route. Audio playback is entirely blob: URLs. The SW
// never sees a media request. RangeRequestsPlugin is not imported because
// nothing here serves HTTP media.
