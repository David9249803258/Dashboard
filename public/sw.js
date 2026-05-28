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

// ── Push notifications ────────────────────────────────────────────────────────

self.addEventListener('push', event => {
  let data = { title: '💊 Supplement Reminder', body: 'Time to take your supplement', tag: 'supplement' };
  try { data = event.data.json(); } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.svg',
      badge: '/icon-192.svg',
      tag: data.tag || 'supplement-reminder',
      requireInteraction: false,
      actions: [
        { action: 'taken', title: '✅ Mark as taken' },
        { action: 'snooze', title: '⏰ Snooze 30 min' },
      ],
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const suppId = event.notification.tag;
  let url = '/';
  if (event.action === 'taken') {
    url = '/?action=mark-taken&supp=' + suppId;
  } else if (event.action === 'snooze') {
    url = '/?action=snooze&supp=' + suppId;
  }
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.startsWith(self.location.origin));
      if (existing) return existing.focus().then(c => c.navigate(url));
      return clients.openWindow(url);
    })
  );
});
