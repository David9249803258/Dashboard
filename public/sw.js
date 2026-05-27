const CACHE_VERSION = 'dashboard-' + Date.now();
const SHELL = ['/', '/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(CACHE_VERSION);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch {
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response('Offline', { status: 503 });
  }
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (
    e.request.url.includes('/api/') ||
    e.request.url.includes('supabase') ||
    e.request.url.includes('anthropic') ||
    e.request.url.includes('usda')
  ) return;
  e.respondWith(networkFirst(e.request));
});
