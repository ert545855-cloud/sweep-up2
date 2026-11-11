// Yönetim paneli bildirimleri (destek talepleri vb.)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data.json(); } catch { d = { title: 'SwipeUp yönetim', body: e.data?.text() || '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'SwipeUp yönetim', { body: d.body || '', icon: d.icon || '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: d.tag, renotify: true, data: { url: d.url || self.registration.scope } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || self.registration.scope;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ws) => {
    const w = ws.find((x) => x.url.startsWith(self.registration.scope));
    if (w) { w.focus(); return w.navigate(url).catch(() => {}); }
    return self.clients.openWindow(url);
  }));
});
