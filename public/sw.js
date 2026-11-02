// SwipeUp service worker: anlık bildirimler + çevrimdışı kabuk
const CACHE = 'swipeup-v11';
const SHELL = ['/', '/css/app.css', '/js/app.js', '/js/core.js', '/js/icons.js', '/js/components.js', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/mark.png', '/js/music.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (/^\/(api|media|socket\.io)/.test(u.pathname)) return;
  // Önce ağ, olmazsa önbellek
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request).then((r) => r || caches.match('/'))));
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data.json(); } catch { d = { title: 'SwipeUp', body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'SwipeUp', {
    body: d.body || '',
    icon: d.icon || '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: d.tag,
    renotify: !!d.tag,
    data: { url: d.url || '/' },
    vibrate: d.call ? [400, 200, 400, 200, 400] : [40, 30, 40],
    requireInteraction: !!d.call,
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '/', location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if (new URL(c.url).origin === location.origin) {
        c.postMessage({ type: 'navigate', url });
        return c.focus();
      }
    }
    return self.clients.openWindow(url);
  }));
});
